from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_optional_user_id
from app.core.logging import get_logger
from app.core.rate_limit import CHAT_RATE_LIMIT, limiter
from app.database.database import get_db_session
from app.database.models import ChatMessage
from app.schemas.chat import ChatRequest, ChatResponse
from app.services import agent_service

LOGGER = get_logger(__name__)

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
@limiter.limit(CHAT_RATE_LIMIT)
async def chat(
    request: Request,
    payload: ChatRequest,
    user_id: uuid.UUID | None = Depends(get_optional_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> ChatResponse:
    """
    Matches frontend/src/api.js's sendChatMessage(): the primary text-chat
    entry point into the multi-agent orchestrator (services/agent_service.py
    -> app/agents/graph.py, falling back to conversation_agent.py). Works
    for both guests (user_id is None - no patient_id required, no history
    persisted) and signed-in patients (user_id from the JWT, independent of
    whatever `patient_id` the frontend sent, so a turn can never be
    persisted under someone else's account).
    """
    effective_patient_id = str(user_id) if user_id else payload.patient_id

    result = await agent_service.run_turn(
        session=session,
        message=payload.message,
        patient_id=effective_patient_id,
        history=payload.history,
        profile=payload.profile,
        recent_report_summary=payload.recent_report_summary,
    )

    # Persist chat history for signed-in patients only (audit fix: "Chat
    # history lives only in React state ... nothing is persisted
    # server-side"). Guest chat intentionally stays session-only, matching
    # the guest-mode messaging already shown elsewhere in the frontend.
    if user_id is not None:
        try:
            session.add_all(
                [
                    ChatMessage(patient_id=user_id, role="user", content=payload.message),
                    ChatMessage(
                        patient_id=user_id,
                        role="assistant",
                        content=result.reply,
                        agent=result.agent,
                        urgent=result.urgent,
                    ),
                ]
            )
            await session.commit()
        except Exception as exc:  # best-effort - never block a reply on this
            LOGGER.warning(f"Failed to persist chat history for user_id={user_id}: {exc}")
            await session.rollback()

    return ChatResponse(
        agent=result.agent,
        reply=result.reply,
        urgent=result.urgent,
        evidence=result.evidence,
        risk_signal=result.risk_signal,
        care_plan=result.care_plan,
        follow_up=result.follow_up,
        router_reason=result.router_reason,
    )


@router.get("/history", response_model=list[dict])
async def get_chat_history(
    limit: int = 100,
    user_id: uuid.UUID = Depends(get_optional_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Returns this patient's persisted chat turns in send order, so a
    signed-in account's conversation survives a page refresh instead of
    resetting to the greeting every time (guests have no history to load -
    an empty list is returned rather than a 401, since guest sessions are
    session-only by design)."""
    if user_id is None:
        return []
    rows = (
        await session.execute(
            select(ChatMessage)
            .where(ChatMessage.patient_id == user_id)
            .order_by(ChatMessage.created_at.asc())
            .limit(max(1, min(limit, 500)))
        )
    ).scalars().all()
    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "agent": m.agent,
            "urgent": m.urgent,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in rows
    ]