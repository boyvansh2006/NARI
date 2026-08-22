from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatHistoryItem(BaseModel):
    """One prior turn, as sent by the frontend's recentHistoryPayload()
    (`{ role: m.sender, content: m.text }`, m.sender being "user" or
    "assistant")."""

    role: Literal["user", "assistant"]
    content: str


class HealthProfile(BaseModel):
    """Mirrors every field conversation_agent.py's _profile_context() reads
    off a profile. All optional since the frontend currently only ever
    sends a partial demo profile (see App.jsx's DEMO_PROFILE)."""

    full_name: str | None = None
    age: int | None = None
    biological_sex: str | None = None
    cycle_day: int | None = None
    cycle_phase: str | None = None
    conditions: str | None = None
    medications: str | None = None
    allergies: str | None = None
    sleep_hours: float | None = None
    exercise_frequency: str | None = None
    goals: str | None = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    history: list[ChatHistoryItem] = Field(default_factory=list)
    profile: HealthProfile | None = None
    recent_report_summary: str | None = None
    # GGSIPU2617 extension: when the frontend has a real signed-in patient
    # id (not the current anonymous demo flow - see App.jsx's
    # DEMO_PROFILE), pass it so the graph can pull longitudinal context
    # (cycles/symptoms/labs) via services/dht_service.py for the Risk
    # Prediction Agent. Optional and safe to omit entirely.
    patient_id: str | None = None


class ChatResponse(BaseModel):
    agent: str
    reply: str
    urgent: bool = False
    # GGSIPU2617 extension: populated when the request went through the
    # real LangGraph multi-agent orchestrator (app/agents/graph.py) rather
    # than the conversation_agent.py fallback. All optional/empty on the
    # fallback path so existing frontend code that only reads
    # {agent, reply, urgent} keeps working unchanged.
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    risk_signal: dict[str, Any] | None = None
    care_plan: dict[str, Any] | None = None
    follow_up: dict[str, Any] | None = None
    router_reason: str | None = None
