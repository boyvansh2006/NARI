from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.activity import router as activity_router
from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.cycles import router as cycles_router
from app.api.google_fit import router as google_fit_router
from app.api.reminders import router as reminders_router
from app.api.reports import router as reports_router
from app.api.voice import router as voice_router
from app.core.config import get_settings
from app.core.exceptions import NARIError, AarogyaError
from app.core.logging import configure_logging, get_logger
from app.core.rate_limit import limiter
from app.database.database import init_db
from app.services.voice_service import get_voice_service

settings = get_settings()
configure_logging(settings.log_level)
LOGGER = get_logger(__name__)


def assert_production_config() -> None:
    """
    Fail *startup* (not the first request) if this is about to run in
    production with unsafe defaults. Audit findings this closes:

      - "jwt_secret_key silently falls back to 'insecure-dev-secret-
        change-me' if unset" -> now refuses to boot instead.
      - "CORS defaults to allow_origins=['*'] combined with
        allow_credentials=True" -> production must set explicit origins;
        wildcard origins are never allowed once ENVIRONMENT=production.

    Deliberately does nothing when ENVIRONMENT is unset/"development" so
    the zero-configuration local dev experience this project is built
    around (see core/config.py's Settings docstring) is unaffected.
    """
    if not settings.is_production:
        return
    problems: list[str] = []
    if not settings.jwt_secret_key:
        problems.append("JWT_SECRET_KEY must be set when ENVIRONMENT=production")
    if not settings.cors_origins:
        problems.append(
            "CORS_ORIGINS must be set to an explicit, comma-separated list of "
            "allowed origins when ENVIRONMENT=production (refusing to fall back "
            "to '*' with allow_credentials=True)"
        )
    if "*" in settings.cors_origins:
        problems.append("CORS_ORIGINS must not include '*' when ENVIRONMENT=production")
    if problems:
        raise RuntimeError(
            "Refusing to start with an unsafe production configuration:\n- "
            + "\n- ".join(problems)
        )


assert_production_config()


@asynccontextmanager
async def lifespan(app: FastAPI):
    LOGGER.info("Starting NARI backend")
    await init_db()
    # VoiceService's __init__ synchronously loads faster-whisper/Piper
    # (can take a few seconds when models are configured). Warm it up here,
    # off the event loop, so the first real /api/v1/voice request isn't the
    # one paying that cost.
    await asyncio.to_thread(get_voice_service)
    yield
    LOGGER.info("Shutting down NARI backend")


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)

# Rate limiting (audit finding: "No rate limiting anywhere (login, chat,
# upload) - brute-forceable and abuse-prone"). See core/rate_limit.py for
# the shared Limiter instance and per-route limits; individual endpoints
# opt in with @limiter.limit(...) (api/auth.py, api/chat.py, api/reports.py).
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS (audit finding: "CORS defaults to allow_origins=['*'] combined with
# allow_credentials=True"). No more silent "*" fallback: an empty
# CORS_ORIGINS now means "no cross-origin browser access", which is a safe
# (if perhaps surprising) default rather than "any site can send
# credentialed requests". assert_production_config() above additionally
# refuses to boot at all in production without explicit origins.
if "*" in settings.cors_origins:
    LOGGER.warning(
        "CORS_ORIGINS includes '*' - combined with allow_credentials=True this "
        "allows any site to make credentialed requests to this API. Do not use "
        "in production; set CORS_ORIGINS to an explicit origin list instead."
    )
elif not settings.cors_origins:
    LOGGER.warning("CORS_ORIGINS is empty - cross-origin browser requests will be blocked.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(NARIError)
async def nari_error_handler(_: Request, exc: NARIError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    # exc.errors() can contain non-JSON-serializable values in its "ctx"
    # dict (e.g. the original exception instance for certain validators),
    # which would make JSONResponse's json.dumps raise. jsonable_encoder
    # sanitizes it first - this is exactly what FastAPI's own default
    # handler does under the hood.
    return JSONResponse(status_code=422, content=jsonable_encoder({"detail": exc.errors()}))


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
async def root() -> dict[str, str]:
    return {"name": settings.app_name, "status": "running", "docs": "/docs"}


app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(reports_router)
app.include_router(voice_router)
app.include_router(reminders_router)
app.include_router(activity_router)
app.include_router(cycles_router)
app.include_router(google_fit_router)