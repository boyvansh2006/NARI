"""
Emergency Escalation Agent.

SRAI - Safety Framework is explicit: "Red flags bypass routine
conversational flow... controlled rules trigger urgent/emergency guidance;
do not delay for more questions" and "Do not let LLM improvise emergency
criteria". So detection here is a plain keyword/rule matcher that runs
*before* any LLM call in the orchestration graph (see agents/graph.py) -
never something an LLM decides on the fly. A real deployment would replace
RED_FLAG_KEYWORDS/CRISIS_KEYWORDS with a clinician-approved, versioned rule
set (see MAS - Data Contracts: Emergency Escalation's rule_version field);
these lists are a reasonable starting point, not a clinically validated one.
"""
from __future__ import annotations

from dataclasses import dataclass

RED_FLAG_KEYWORDS = [
    "chest pain", "severe pain", "unbearable pain", "heavy bleeding",
    "soaking a pad every hour", "soaking through a pad", "can't breathe",
    "cannot breathe", "fainted", "fainting", "severe headache",
    "vision loss", "seizure", "convulsion", "high fever", "unresponsive",
    "sudden severe", "coughing blood", "blue lips",
]

CRISIS_KEYWORDS = [
    "suicidal", "kill myself", "end my life", "want to die",
    "harm myself", "hurt myself", "self-harm", "no reason to live",
]

# India-context example crisis resources. VERIFY THESE ARE CURRENT before
# any real deployment - this project has no way to confirm live phone
# numbers/services from this environment (see README).
CRISIS_RESOURCES_TEXT = (
    "If you are thinking about harming yourself, please reach out right now:\n"
    "- iCall (Tata Institute of Social Sciences): 9152987821\n"
    "- Vandrevala Foundation Helpline: 1860-2662-345 / 1800-2333-330\n"
    "- KIRAN Mental Health Helpline (Govt. of India): 1800-599-0019\n"
    "- Emergency services: 112\n"
    "You don't have to be in crisis to call - these lines are for support at any point. "
    "If you are in immediate danger, please call emergency services or go to the nearest emergency room."
)


@dataclass
class EmergencyCheck:
    triggered: bool
    is_crisis: bool = False
    matched_keyword: str | None = None


def check_emergency(text: str) -> EmergencyCheck:
    lowered = text.lower()
    for kw in CRISIS_KEYWORDS:
        if kw in lowered:
            return EmergencyCheck(triggered=True, is_crisis=True, matched_keyword=kw)
    for kw in RED_FLAG_KEYWORDS:
        if kw in lowered:
            return EmergencyCheck(triggered=True, is_crisis=False, matched_keyword=kw)
    return EmergencyCheck(triggered=False)


def build_escalation_reply(check: EmergencyCheck) -> str:
    if check.is_crisis:
        return (
            "I'm really glad you told me. This sounds serious, and I want you to be safe right now.\n\n"
            + CRISIS_RESOURCES_TEXT
        )
    return (
        "What you're describing could need urgent attention. Please contact a doctor or emergency "
        "services right now rather than waiting - I've flagged this conversation so it's not "
        "treated as routine."
    )