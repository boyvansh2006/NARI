"""
Shared agent-routing + reply logic for both the text chat endpoint and the
voice endpoint.

Two response paths, matching the "degrade gracefully" philosophy both
source projects already used:

  1. LLM path (Groq, same provider Vitalis's parser already depends on):
     one call asks the model to pick the single best-fit agent from the
     platform's agent roster AND draft the reply, returned as JSON. This
     replaces Aarogya's `getAgentResponse()` keyword matcher with a real
     model call, while keeping its exact agent taxonomy.

  2. Template fallback (no GROQ_API_KEY configured, or the call fails):
     Aarogya's original rule-based `getAgentResponse()` function, ported
     line-for-line from aarogya-app.jsx into Python. This is the same role
     MAITRI's GENERIC_TEMPLATES/_template_response played when Ollama
     wasn't available - a safety net, not the primary path.
"""
from __future__ import annotations

import json
from dataclasses import dataclass

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.chat import ChatHistoryItem, HealthProfile

LOGGER = get_logger(__name__)
GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"

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

SYSTEM_PROMPT = (
    "You are NARI, an agentic AI women's health companion made up of specialist "
    "sub-agents: " + ", ".join(AGENT_ROSTER) + ". "
    "For every message, pick the SINGLE most relevant agent from that exact list, and "
    "reply in 1-3 warm, plain-language sentences as that agent would. Use the user's "
    "health profile and recent report context when relevant. Never diagnose or "
    "prescribe - flag anything that could be diagnostic as worth discussing with a "
    "clinician. If the message describes a potential emergency (e.g. severe/heavy "
    "bleeding, chest pain, fainting, can't breathe), set agent to 'Emergency "
    "Escalation', urgent to true, and tell them to seek care immediately. "
    "Respond ONLY as JSON: {\"agent\": string, \"reply\": string, \"urgent\": boolean}."
)


@dataclass
class AgentReply:
    agent: str
    reply: str
    urgent: bool = False


def _profile_context(profile: HealthProfile | None) -> str:
    if not profile:
        return "No health profile provided yet."
    fields = {
        "Full name": profile.full_name,
        "Age": profile.age,
        "Biological sex": profile.biological_sex,
        "Cycle day": profile.cycle_day,
        "Cycle phase": profile.cycle_phase,
        "Known conditions": profile.conditions,
        "Current medications": profile.medications,
        "Allergies": profile.allergies,
        "Sleep hours": profile.sleep_hours,
        "Exercise frequency": profile.exercise_frequency,
        "Goals": profile.goals,
    }
    return "\n".join(f"{k}: {v}" for k, v in fields.items() if v not in (None, ""))


def _call_groq_agent(
    message: str,
    history: list[ChatHistoryItem],
    profile: HealthProfile | None,
    recent_report_summary: str | None,
    api_key: str,
    model: str,
    timeout: float = 60.0,
) -> AgentReply:
    user_context = (
        f"User health profile:\n{_profile_context(profile)}\n\n"
        f"Recent report context: {recent_report_summary or 'not provided'}"
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_context},
    ]
    for item in history[-8:]:
        if item.role in {"user", "assistant"}:
            messages.append({"role": item.role, "content": item.content})
    messages.append({"role": "user", "content": message})

    response = httpx.post(
        GROQ_CHAT_COMPLETIONS_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": messages,
            "temperature": 0.4,
            "response_format": {"type": "json_object"},
        },
        timeout=timeout,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    parsed = json.loads(content)

    agent = str(parsed.get("agent") or "Clinical Knowledge Retrieval")
    if agent not in AGENT_ROSTER:
        agent = "Clinical Knowledge Retrieval"
    reply = str(parsed.get("reply") or "").strip()
    if not reply:
        raise ValueError("Empty reply from LLM")
    urgent = bool(parsed.get("urgent", False))
    return AgentReply(agent=agent, reply=reply, urgent=urgent)


# --- Offline fallback: Aarogya's original getAgentResponse(), ported from
# aarogya-app.jsx's rule-based keyword router almost line-for-line. -------

_RULES: list[tuple[list[str], str, bool, str]] = [
    (
        ["chest pain", "severe pain", "heavy bleeding", "can't breathe", "cannot breathe", "fainted", "faint"],
        "Emergency Escalation",
        True,
        "This could need urgent attention. Please contact a doctor or emergency services right "
        "now - I've flagged this conversation so your care team sees it immediately.",
    ),
    (
        ["cramp", "pain", "period", "bleeding", "symptom", "ache"],
        "Symptom Assessment",
        False,
        "Thanks for logging that. Mild-to-moderate cramping is common around this phase of your "
        "cycle, and I've added it to your timeline. Tell me if it gets severe or doesn't ease with rest.",
    ),
    (
        ["lab", "report", "ferritin", "hemoglobin", "blood test", "result"],
        "Laboratory Report Interpretation",
        False,
        "I can help interpret that once it's uploaded in Reports, or tell me the values here and "
        "I'll walk you through what's in and out of range.",
    ),
    (
        ["pcos", "hormone", "hormonal", "irregular"],
        "Risk Prediction",
        False,
        "I can't diagnose PCOS, but cycle irregularity and hormonal patterns are worth reviewing "
        "with your doctor. I can help you track the pattern in the meantime.",
    ),
    (
        ["eat", "food", "diet", "nutrition", "meal"],
        "Nutrition Planning",
        False,
        "Happy to help with that. Tell me what's been flagged in your recent labs (if anything) "
        "and I can suggest a food-first plan around it.",
    ),
    (
        ["stress", "anxious", "mood", "sad", "overwhelmed", "mental"],
        "Mental Wellness Support",
        False,
        "Thanks for sharing that. Would a short breathing exercise help right now, or would you "
        "rather talk through what's going on?",
    ),
    (
        ["medication", "tablet", "pill", "dose", "supplement"],
        "Medication & Adherence",
        False,
        "I can help track that. Want me to set a daily reminder at a consistent time?",
    ),
    (
        ["appointment", "doctor", "book", "schedule", "visit"],
        "Appointment Management",
        False,
        "I can help with that. Tell me what it's regarding and I'll help you find a suitable slot.",
    ),
    (
        ["sleep", "tired", "fatigue", "energy"],
        "Lifestyle Coaching",
        False,
        "Sleep and fatigue are closely linked - even a 20-minute earlier wind-down can help. "
        "Want a plan for that?",
    ),
]


def _template_agent_response(message: str) -> AgentReply:
    text = message.lower()
    for keywords, agent, urgent, reply in _RULES:
        if any(word in text for word in keywords):
            return AgentReply(agent=agent, reply=reply, urgent=urgent)
    return AgentReply(
        agent="Clinical Knowledge Retrieval",
        reply=(
            "I want to make sure that's answered properly - could you tell me a bit more, or ask "
            "about a specific symptom, lab result, or routine? For anything urgent, please contact "
            "your doctor directly."
        ),
        urgent=False,
    )


def get_agent_reply(
    message: str,
    history: list[ChatHistoryItem] | None = None,
    profile: HealthProfile | None = None,
    recent_report_summary: str | None = None,
) -> AgentReply:
    settings = get_settings()
    history = history or []

    if settings.groq_api_key:
        try:
            return _call_groq_agent(
                message,
                history,
                profile,
                recent_report_summary,
                settings.groq_api_key,
                settings.groq_model,
                timeout=settings.request_timeout_seconds,
            )
        except Exception as exc:
            LOGGER.warning(f"Groq agent call failed, falling back to template router: {exc}")

    return _template_agent_response(message)