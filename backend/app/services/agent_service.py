"""
Single entry point the API layer (api/chat.py, api/voice.py) calls for one
conversational turn.

This is the wiring step the rest of app/agents/ was missing: graph.py /
nodes.py / risk_engine.py / rag_service.py / emergency.py all existed and
imported cleanly from each other, but nothing in api/ ever called
`app.agents.graph.run_turn`, so the real multi-agent orchestrator never
actually ran - every request still went through
services/conversation_agent.py's single-LLM-call router instead. This
module is the fix: it's the one place that

  1. builds `structured_context` for the graph (services/dht_service.py),
  2. calls `app.agents.graph.run_turn` (synchronous / CPU+IO-bound, so it
     always runs via asyncio.to_thread - never awaited directly),
  3. falls back to the old conversation_agent.get_agent_reply() template/
     Groq router if the graph raises for any reason (e.g. langgraph isn't
     installed, or an unexpected exception in a node) so a turn always
     gets *some* reply rather than a 500,
  4. shapes the result into the flat dict api/chat.py and api/voice.py
     both hand back to the frontend (schemas/chat.py's ChatResponse).
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.schemas.chat import ChatHistoryItem, HealthProfile
from app.services import dht_service
from app.services.conversation_agent import get_agent_reply

LOGGER = get_logger(__name__)


@dataclass
class TurnResult:
    agent: str
    reply: str
    urgent: bool = False
    evidence: list[dict[str, Any]] = field(default_factory=list)
    risk_signal: dict[str, Any] | None = None
    care_plan: dict[str, Any] | None = None
    follow_up: dict[str, Any] | None = None
    router_reason: str | None = None
    # 2-3 short, tappable next-question suggestions from the specialist
    # node's reply (see agents/nodes.py) - lets the frontend offer them as
    # quick-reply chips instead of the agent dumping every related
    # sub-topic into one oversized answer.
    follow_up_questions: list[str] = field(default_factory=list)


def _history_dicts(history: list[ChatHistoryItem] | None) -> list[dict[str, str]]:
    return [{"role": item.role, "content": item.content} for item in (history or [])]


def _run_graph_sync(
    message: str,
    patient_id: str | None,
    history: list[dict[str, str]],
    profile: dict | None,
    structured_context: dict,
) -> TurnResult:
    # Imported lazily so a missing/broken `langgraph` install only breaks
    # the graph path (caught below and falls back to conversation_agent),
    # not the whole app at import time.
    from app.agents.graph import run_turn

    state = run_turn(
        message=message,
        patient_id=patient_id,
        history=history,
        profile=profile,
        structured_context=structured_context,
    )
    return TurnResult(
        agent=state.get("router_agent") or "Emergency Escalation",
        reply=state.get("reply") or "",
        urgent=bool(state.get("urgent")),
        evidence=state.get("evidence") or [],
        risk_signal=state.get("risk_signal"),
        care_plan=state.get("care_plan"),
        follow_up=state.get("follow_up"),
        router_reason=state.get("router_reason"),
        follow_up_questions=state.get("follow_up_questions") or [],
    )


async def run_turn(
    *,
    session: AsyncSession | None,
    message: str,
    patient_id: str | None = None,
    history: list[ChatHistoryItem] | None = None,
    profile: HealthProfile | None = None,
    recent_report_summary: str | None = None,
) -> TurnResult:
    """Main entry point. Always returns a TurnResult - never raises for a
    graph-path failure, only for something outside its control (e.g. the
    event loop itself going away)."""
    structured_context: dict = {}
    if session is not None and patient_id:
        structured_context = await dht_service.build_structured_context(session, patient_id)

    profile_dict = profile.model_dump() if profile else None

    try:
        return await asyncio.to_thread(
            _run_graph_sync,
            message,
            patient_id,
            _history_dicts(history),
            profile_dict,
            structured_context,
        )
    except Exception as exc:
        LOGGER.warning(f"Multi-agent graph failed, falling back to conversation_agent: {exc}")

    fallback = await asyncio.to_thread(
        get_agent_reply, message, history or [], profile, recent_report_summary
    )
    return TurnResult(agent=fallback.agent, reply=fallback.reply, urgent=fallback.urgent)
