from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings
from app.database.models import Base, EvidenceSource

settings = get_settings()


def _build_database_url() -> str:
    """
    Reused from Vitalis's _build_database_url, extended with a SQLite
    default so the app boots with zero configuration. Set DATABASE_URL to
    a postgresql[+asyncpg]:// URL (e.g. a managed Postgres/Supabase
    instance) to use that instead.
    """
    raw_url = settings.database_url.strip()
    if not raw_url:
        settings.uploads_dir.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite+aiosqlite:///{settings.sqlite_path}"

    if raw_url.startswith("postgresql+asyncpg://"):
        return raw_url
    if raw_url.startswith("postgresql://"):
        return raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if raw_url.startswith("postgres://"):
        return raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
    return raw_url


DATABASE_URL = _build_database_url()

_engine_kwargs: dict = {}
if DATABASE_URL.startswith("postgresql+asyncpg://"):
    from sqlalchemy.pool import NullPool

    _engine_kwargs["poolclass"] = NullPool

engine: AsyncEngine = create_async_engine(DATABASE_URL, **_engine_kwargs)

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    await _seed_evidence_sources()


async def _seed_evidence_sources() -> None:
    """Seeds the evidence_sources table from app/data/knowledge_base.py on
    first boot, so citations returned by the RAG agent (which reads the
    knowledge_base module directly, not this table - see
    services/rag_service.py) can be joined back to full source metadata via
    a real table rather than only living in a Python module. Idempotent:
    skips entirely if the table already has rows."""
    from sqlalchemy import select

    from app.data.knowledge_base import EVIDENCE_SOURCES

    async with async_session_factory() as session:
        existing = (await session.execute(select(EvidenceSource.id).limit(1))).first()
        if existing:
            return
        for src in EVIDENCE_SOURCES:
            session.add(
                EvidenceSource(
                    id=src["id"],
                    domain=src["domain"],
                    organization=src["organization"],
                    title=src["title"],
                    source_type=src["source_type"],
                    scope=src.get("scope", "Global"),
                    publication_date=src.get("publication_date"),
                    evidence_tier=src.get("evidence_tier", 3),
                    topics=src.get("topics"),
                    url=src.get("url"),
                    limitations=src.get("limitations"),
                )
            )
        await session.commit()


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with async_session_factory() as session:
        yield session