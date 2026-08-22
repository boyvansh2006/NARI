"""
Deterministic offline responder for app/services/llm_client.py.

Every agent node in app/agents/nodes.py calls `complete_json(...,
mock_key=..., mock_context=...)`. When no LLM provider is configured
(LLM_PROVIDER=mock, or no GROQ/OPENAI/GEMINI key set, or a real call
fails) `llm_client.complete_json` falls back to `mock_reply()` below
instead of raising - this is what lets the whole LangGraph agent graph
(app/agents/graph.py) be exercised end-to-end with zero API keys, e.g. in
CI, offline demos, or the first minute after cloning the repo before
anyone has added a key.

Each function returns a dict shaped exactly like the JSON the real LLM
call for that mock_key is prompted to return (see the matching prompt in
app/agents/nodes.py) - callers never need to branch on "is this a real or
mock reply", they just read the same keys either way.

These are intentionally simple templates, not a second copy of the
knowledge base - the actual grounded content for a turn comes from
app/services/rag_service.py's retrieval step, which runs regardless of
which LLM provider (real or mock) drafts the final sentence.
"""
from __future__ import annotations

from typing import Any


def _router_reply(context: dict[str, Any]) -> dict[str, Any]:
    message = str(context.get("message", "")).lower()
    keyword_map = [
        (["pcos", "hormone", "hormonal", "irregular"], "Risk Prediction"),
        (["lab", "report", "ferritin", "hemoglobin", "blood test", "result"], "Laboratory Report Interpretation"),
        (["eat", "food", "diet", "nutrition", "meal"], "Nutrition Planning"),
        (["stress", "anxious", "mood", "sad", "overwhelmed", "mental"], "Mental Wellness Support"),
        (["medication", "tablet", "pill", "dose", "supplement"], "Medication & Adherence"),
        (["appointment", "doctor", "book", "schedule", "visit"], "Appointment Management"),
        (["sleep", "tired", "fatigue", "energy", "activity", "exercise"], "Lifestyle Coaching"),
        (["document", "upload", "scan", "prescription"], "Medical Document Intelligence"),
        (["cramp", "pain", "period", "bleeding", "symptom", "ache"], "Symptom Assessment"),
    ]
    for keywords, agent in keyword_map:
        if any(kw in message for kw in keywords):
            return {"agent": agent, "urgent": False, "reason": f"offline keyword match ({keywords[0]})"}
    return {
        "agent": "Clinical Knowledge Retrieval",
        "urgent": False,
        "reason": "no offline keyword matched; defaulting to general clinical knowledge lookup",
    }


def _symptom_agent_reply(context: dict[str, Any]) -> dict[str, Any]:
    message = str(context.get("message", "")).strip()
    return {
        "reply": (
            f"Thanks for logging that{': ' + message if message else ''}. I've noted it on your timeline. "
            "Could you tell me how severe it feels (mild/moderate/severe) and roughly when it started? "
            "I can't diagnose this, but tracking it will help a clinician if you decide to follow up."
        ),
        "follow_up_questions": [
            "On a scale of 0-10, how severe is it?",
            "When did it start, and is it linked to your cycle?",
            "Any other symptoms alongside it?",
        ],
        "urgency_flag": "none",
    }


def _lab_agent_reply(context: dict[str, Any]) -> dict[str, Any]:
    metrics = context.get("metrics") or []
    abnormal = [m for m in metrics if str(m.get("status", "")).upper() in {"HIGH", "LOW"}]
    if abnormal:
        names = ", ".join(str(m.get("biomarker_name", "a value")) for m in abnormal[:3])
        reply = (
            f"Looking at your recent results, {names} came back outside the typical reference range. "
            "That's common and doesn't confirm a diagnosis on its own - it's worth reviewing with your "
            "clinician alongside your symptoms and history."
        )
    else:
        reply = (
            "I don't see any values flagged outside range in what's been uploaded so far. Upload a "
            "report in Reports and I can walk through it value by value."
        )
    return {"reply": reply, "attention_flag": bool(abnormal)}


def _nutrition_agent_reply(context: dict[str, Any]) -> dict[str, Any]:
    evidence = context.get("evidence") or []
    hint = f" Building on this: {evidence[0]['text']}" if evidence else ""
    return {
        "reply": (
            "A good starting point is a balanced plate: protein, fibre-rich carbs, and healthy fats at "
            "each meal, with iron- and calcium-rich foods worth prioritising for women's health specifically. "
            f"{hint} Tell me about a recent lab flag or symptom and I can make this more specific."
        ),
        "goal": "balanced-nutrition",
    }


def _mental_wellness_reply(context: dict[str, Any]) -> dict[str, Any]:
    return {
        "reply": (
            "Thank you for sharing that - it takes courage to say it out loud. Would a short breathing "
            "exercise help right now, or would you rather talk through what's going on? I'm here either way, "
            "and if things ever feel unmanageable, please reach out to a mental-health professional or "
            "crisis line."
        ),
        "escalation_flag": False,
    }


def _medication_agent_reply(context: dict[str, Any]) -> dict[str, Any]:
    return {
        "reply": (
            "I can help you track this medication and set adherence reminders. I can't advise starting, "
            "stopping, or changing a dose myself - please confirm any changes with your prescriber."
        )
    }


def _lifestyle_agent_reply(context: dict[str, Any]) -> dict[str, Any]:
    return {
        "reply": (
            "One small, achievable change: try moving your wind-down routine 20 minutes earlier tonight "
            "and keeping screens out of the last 15 minutes before bed. Small, consistent changes tend to "
            "stick better than big ones."
        )
    }


def _appointment_agent_reply(context: dict[str, Any]) -> dict[str, Any]:
    return {
        "reply": (
            "I can help coordinate that. Let me know the specialty you're looking for (e.g. gynaecologist, "
            "endocrinologist) and a rough timeframe, and I'll help you request a slot."
        )
    }


_MOCK_HANDLERS = {
    "router": _router_reply,
    "symptom_agent": _symptom_agent_reply,
    "lab_agent": _lab_agent_reply,
    "nutrition_agent": _nutrition_agent_reply,
    "mental_wellness_agent": _mental_wellness_reply,
    "medication_agent": _medication_agent_reply,
    "lifestyle_agent": _lifestyle_agent_reply,
    "appointment_agent": _appointment_agent_reply,
}


def mock_reply(mock_key: str, mock_context: dict[str, Any]) -> dict[str, Any]:
    """Single entry point used by llm_client.complete_json(). Unknown keys
    fall back to a generic, safe, non-diagnostic reply rather than raising,
    so a new agent node added later without a matching mock handler still
    degrades gracefully instead of crashing the whole turn."""
    handler = _MOCK_HANDLERS.get(mock_key)
    if handler:
        return handler(mock_context)
    return {
        "reply": (
            "I want to make sure that's answered properly - could you share a bit more detail? For "
            "anything urgent, please contact your doctor or local emergency services directly."
        )
    }
