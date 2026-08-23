from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.activity import router as activity_router
from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.reminders import router as reminders_router
from app.api.reports import router as reports_router
from app.api.voice import router as voice_router
from app.core.config import get_settings
from app.core.exceptions import NARIError, AarogyaError
from app.core.logging import configure_logging, get_logger
from app.database.database import init_db
from app.services.voice_service import get_voice_service

settings = get_settings()
configure_logging(settings.log_level)
LOGGER = get_logger(__name__)


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
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