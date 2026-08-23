from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field

PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = PROJECT_ROOT / "backend"

env_file = PROJECT_ROOT / ".env"
if env_file.exists():
    load_dotenv(env_file, override=False)


class Settings(BaseModel):
    """
    Reused from Vitalis (IBMIE) core/config.py but relaxed: the original
    required Supabase env vars to even boot. Here everything has a working
    local default (SQLite on disk, local file storage) so the app runs with
    zero configuration, and swaps to Postgres/Groq/Ollama/Piper only when
    those env vars are actually provided.
    """

    model_config = ConfigDict(extra="ignore")

    app_name: str = "NARI Backend"
    app_version: str = "0.1.0"
    environment: str = Field(default="development")

    # Database: defaults to a local SQLite file. Set DATABASE_URL to a
    # postgresql+asyncpg:// URL (e.g. Supabase) to use Postgres instead.
    database_url: str = Field(default="")

    cors_origins_raw: str = Field(default="http://localhost:5173,http://127.0.0.1:5173")
    log_level: str = Field(default="INFO")
    max_upload_size_mb: int = Field(default=25, ge=1)
    request_timeout_seconds: float = Field(default=120.0, gt=0)
    # Optional system-binary locations used by the report OCR pipeline.
    # These are especially useful on Windows, where they are not usually on PATH.
    tesseract_cmd: str = Field(default="")
    poppler_path: str = Field(default="")

    # Lab report / chat LLM (from Vitalis's Groq integration)
    groq_api_key: str = Field(default="")
    groq_model: str = Field(default="openai/gpt-oss-120b")

    # GGSIPU2617 extension -------------------------------------------------
    # Generic LLM provider switch for the multi-agent system (app/agents/).
    # "groq" reuses the Groq integration above; "openai"/"gemini" cover the
    # providers the problem statement names (Gemini/OpenAI/Llama); "mock"
    # needs no network access and returns deterministic template output so
    # the whole agent graph is testable offline.
    llm_provider: str = Field(default="auto")  # auto | groq | openai | gemini | mock
    openai_api_key: str = Field(default="")
    openai_model: str = Field(default="gpt-4o-mini")
    gemini_api_key: str = Field(default="")
    gemini_model: str = Field(default="gemini-1.5-flash")
    # Mistral AI (https://console.mistral.ai/api-keys)
    mistral_api_key: str = Field(default="")
    mistral_model: str = Field(default="mistral-small-2506")

    # Auth (see core/security.py). Falls back to a fixed dev secret if unset.
    jwt_secret_key: str = Field(default="")

    # Voice pipeline (from MAITRI)
    whisper_model_size: str = Field(default="small.en")
    whisper_device: str = Field(default="cpu")
    whisper_compute_type: str = Field(default="int8")
    piper_voice_model: str = Field(default="")
    piper_voice_config: str = Field(default="")
    ollama_host: str = Field(default="")
    ollama_model: str = Field(default="")

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip() for item in self.cors_origins_raw.split(",") if item.strip()]

    @property
    def uploads_dir(self) -> Path:
        return BACKEND_ROOT / "uploads"

    @property
    def models_dir(self) -> Path:
        return BACKEND_ROOT / "models"

    @property
    def sqlite_path(self) -> Path:
        nari_path = BACKEND_ROOT / "nari.db"
        aarogya_path = BACKEND_ROOT / "aarogya.db"
        if aarogya_path.exists() and not nari_path.exists():
            return aarogya_path
        return nari_path


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("APP_NAME", "NARI Backend"),
        app_version=os.getenv("APP_VERSION", "0.1.0"),
        environment=os.getenv("ENVIRONMENT", "development"),
        database_url=os.getenv("DATABASE_URL", ""),
        cors_origins_raw=os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ),
        log_level=os.getenv("LOG_LEVEL", "INFO"),
        max_upload_size_mb=int(os.getenv("MAX_UPLOAD_SIZE_MB", "25")),
        request_timeout_seconds=float(os.getenv("REQUEST_TIMEOUT_SECONDS", "120")),
        tesseract_cmd=os.getenv("TESSERACT_CMD", ""),
        poppler_path=os.getenv("POPPLER_PATH", ""),
        groq_api_key=os.getenv("GROQ_API_KEY", ""),
        groq_model=os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
        llm_provider=os.getenv("LLM_PROVIDER", "auto"),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-1.5-flash"),
        mistral_api_key=os.getenv("MISTRAL_API_KEY", ""),
        mistral_model=os.getenv("MISTRAL_MODEL", "mistral-small-2506"),
        jwt_secret_key=os.getenv("JWT_SECRET_KEY", ""),
        whisper_model_size=os.getenv("WHISPER_MODEL_SIZE", "small.en"),
        whisper_device=os.getenv("WHISPER_DEVICE", "cpu"),
        whisper_compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
        piper_voice_model=os.getenv("PIPER_VOICE_MODEL", ""),
        piper_voice_config=os.getenv("PIPER_VOICE_CONFIG", ""),
        ollama_host=os.getenv("OLLAMA_HOST", ""),
        ollama_model=os.getenv("OLLAMA_MODEL", ""),
    )
