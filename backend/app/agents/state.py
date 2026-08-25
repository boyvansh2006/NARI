"""Shared state definition for the LangGraph multi-agent orchestrator.

See MAS - Agent Specs / MAS - Agent Handoffs / MAS - Data Contracts sheets
for the agent roster and the conceptual input/output contracts this state
is standing in for. Kept as one flat TypedDict (rather than nested
per-agent objects) so it's trivial to log a whole turn's state as an audit
record (SRAI - Safety Framework "Auditability").
"""
from __future__ import annotations

from typing import Any, TypedDict

AGENT_ROSTER = [
    "Symptom Assessment",
    "Clinical Knowledge Retrieval",
    "Laboratory Report Interpretation",
    "Medical Document Intelligence",
    "Nutrition Planning",
    "Mental Wellness Support",
    "Medication & Adherence",
    "Risk Prediction",
    "Lifestyle Coaching",
    "Appointment Management",
    "Emergency Escalation",
    "Follow-up Care",
]


class GraphState(TypedDict, total=False):
    # --- input ---
    patient_id: str | None
    message: str
    history: list[dict[str, str]]
    profile: dict[str, Any] | None
    domain_hint: str | None
    population_hint: str | None
    # structured context the calling service pre-fetched from the DB so
    # agent nodes stay synchronous and DB-agnostic (see risk_engine.py) -
    # e.g. {"cycle_lengths_days": [...], "symptoms": [...], "mood_scores": [...]}
    structured_context: dict[str, Any]

    # --- routing / working state ---
    router_agent: str
    router_reason: str
    urgent: bool
    is_crisis: bool
    escalation_level: str | None

    # --- outputs ---
    reply: str
    # 2-3 short, tappable next-question suggestions (e.g. "Relief tips for
    # this?", "Diet suggestions?") so a specialist reply can stay concise
    # instead of pre-emptively dumping every related sub-topic - see
    # nodes.py's per-agent prompts and App.jsx's per-message chip row.
    follow_up_questions: list[str]
    evidence: list[dict[str, Any]]
    evidence_note: str
    risk_signal: dict[str, Any] | None
    follow_up: dict[str, Any] | None
    care_plan: dict[str, Any] | None

    # --- audit trail: one dict per agent hop, matches AgentEventLog fields ---
    event_log: list[dict[str, Any]]