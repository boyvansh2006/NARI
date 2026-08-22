from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.database.database import get_db_session
from app.schemas.chat import ChatRequest, ChatResponse
from app.services import agent_service

LOGGER = get_logger(__name__)

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    session: AsyncSession = Depends(get_db_session),
) -> ChatResponse:
    """
    Single text-chat turn.

    Routes through the real multi-agent LangGraph orchestrator
    (app/agents/graph.py): Emergency Escalation check -> Router -> Clinical
    Knowledge/RAG -> specialist agent -> Risk Prediction -> Care Plan ->
    Follow-up. Each specialist call uses whichever LLM provider is
    configured (Gemini/OpenAI/Groq - see services/llm_client.py's
    provider resolution, GEMINI_API_KEY works out of the box once set in
    .env) or a deterministic offline mock responder if none is configured.

    Falls back to the older single-call conversation_agent.py router
    (Groq-only, or the rule-based template) if the graph raises for any
    reason - see services/agent_service.py.
    """
    result = await agent_service.run_turn(
        session=session,
        message=request.message,
        patient_id=request.patient_id,
        history=request.history,
        profile=request.profile,
        recent_report_summary=request.recent_report_summary,
    )
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
