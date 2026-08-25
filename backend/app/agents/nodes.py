"""
Node functions for the LangGraph multi-agent graph (see graph.py).

Each specialist node corresponds to one clinical domain in NARI's multi-agent system:
  1. Emergency Escalation (always first safety filter)
  2. Contextual Router (selects specialist and preserves conversation continuity)
  3. Clinical Knowledge / RAG (retrieves grounded WHO & MoHFW guideline snippets)
  4. Specialist Agent (Symptom, Lab, Nutrition, Mental Wellbeing, Medication, Lifestyle, Appointment)
  5. Risk Prediction Heuristic (pattern evaluation)
  6. Care Plan Synthesis (generates structured care cards)
  7. Follow-up Care (schedules proactive continuity checks)
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from app.agents import risk_engine
from app.agents.emergency import build_escalation_reply, check_emergency
from app.agents.state import AGENT_ROSTER, GraphState
from app.core.logging import get_logger
from app.services import rag_service
from app.services.llm_client import LLMMessage, complete_json

LOGGER = get_logger(__name__)

# Maps a router agent label to the RAG domain hint that best matches it
_AGENT_TO_DOMAIN = {
    "Symptom Assessment": None,
    "Risk Prediction": None,
    "Nutrition Planning": "Nutrition",
    "Mental Wellness Support": "Mental Wellbeing",
    "Laboratory Report Interpretation": None,
    "Clinical Knowledge Retrieval": None,
}

_DOMAIN_KEYWORDS = {
    "PCOS": ["pcos", "polycystic", "irregular period", "irregular cycle"],
    "Endometriosis": ["endometriosis", "pelvic pain"],
    "Pregnancy": ["pregnant", "pregnancy", "trimester", "antenatal"],
    "Postpartum": ["postpartum", "postnatal", "after delivery", "after birth"],
    "Menopause": ["menopause", "perimenopause", "hot flash"],
    "Fertility": ["fertility", "infertility", "trying to conceive", "ovulation"],
    "Menstrual Health": ["period", "cycle", "menstru", "cramp", "cramps", "bleeding", "flow"],
    "Mental Wellbeing": ["stress", "anxious", "mood", "depress", "sad", "overwhelmed", "anxiety", "burnout"],
    "Chronic Conditions": ["diabetes", "hypertension", "blood pressure", "cholesterol", "thyroid", "ferritin", "iron"],
}


def _infer_domain(message: str) -> str | None:
    lowered = message.lower()
    for domain, keywords in _DOMAIN_KEYWORDS.items():
        if any(kw in lowered for kw in keywords):
            return domain
    return None


def _log(state: GraphState, agent: str, output_summary: str, handoff_to: str | None = None) -> None:
    state.setdefault("event_log", [])
    state["event_log"].append(
        {
            "agent": agent,
            "input_summary": state.get("message", "")[:300],
            "output_summary": output_summary[:500],
            "handoff_to": handoff_to,
            "urgent": bool(state.get("urgent")),
            "escalation_level": state.get("escalation_level"),
        }
    )


def _build_agent_messages(state: GraphState) -> list[LLMMessage]:
    """Builds a rich, multi-turn LLM message list including past dialogue turns,
    patient profile (e.g. cycle phase), and relevant RAG evidence."""
    msgs: list[LLMMessage] = []

    # 1. Past conversation turns (up to 6)
    history = state.get("history") or []
    for turn in history[-6:]:
        role = "assistant" if turn.get("role") in {"assistant", "model"} else "user"
        content = turn.get("content") or turn.get("text") or ""
        if content:
            msgs.append(LLMMessage(role=role, content=content))

    # 2. Current turn enriched with profile & RAG evidence
    current_msg = state.get("message", "")
    context_parts: list[str] = []

    profile = state.get("profile") or {}
    LANG_NAMES = {
        "hi": "Hindi (हिन्दी)",
        "bn": "Bengali (বাংলা)",
        "ta": "Tamil (தமிழ்)",
        "te": "Telugu (తెలుగు)",
        "mr": "Marathi (मराठी)",
        "gu": "Gujarati (ગુજરાતી)",
        "kn": "Kannada (ಕನ್ನಡ)",
        "ml": "Malayalam (മലയാളം)",
        "pa": "Punjabi (ਪੰਜਾਬੀ)",
        "en": "English",
    }
    lang_pref = profile.get("language_preference") or profile.get("language") or "en"
    if lang_pref and lang_pref != "en":
        target_lang = LANG_NAMES.get(lang_pref, lang_pref)
        context_parts.append(f"Language Directive: Respond fluently and naturally in {target_lang}. Keep medical terminology understandable, respectful, and comforting.")

    if context_parts:
        augmented_text = f"{current_msg}\n\n[Clinical Context: {' | '.join(context_parts)}]"
    else:
        augmented_text = current_msg

    msgs.append(LLMMessage(role="user", content=augmented_text))
    return msgs


# ---------------------------------------------------------------------------
# Emergency Escalation Agent
# ---------------------------------------------------------------------------

def node_emergency_check(state: GraphState) -> GraphState:
    check = check_emergency(state.get("message", ""))
    if check.triggered:
        state["urgent"] = True
        state["is_crisis"] = check.is_crisis
        state["escalation_level"] = "L3"
        state["router_agent"] = "Emergency Escalation"
        state["reply"] = build_escalation_reply(check)
        _log(state, "Emergency Escalation", f"red flag matched: {check.matched_keyword}")
    else:
        state["urgent"] = False
        state["is_crisis"] = False
    return state


# ---------------------------------------------------------------------------
# Router Agent
# ---------------------------------------------------------------------------

ROUTER_SYSTEM_PROMPT = (
    "You are the clinical intake orchestrator for NARI's women's-health multi-agent system. Specialist agents: "
    + ", ".join(a for a in AGENT_ROSTER if a != "Emergency Escalation")
    + ". Pick the SINGLE most relevant specialist agent based on the user's latest query and conversation context.\n"
    'Respond ONLY as JSON: {"agent": string, "urgent": boolean, "reason": string}.'
)


def node_router(state: GraphState) -> GraphState:
    result = complete_json(
        ROUTER_SYSTEM_PROMPT,
        _build_agent_messages(state),
        temperature=0.1,
        mock_key="router",
        mock_context={"message": state.get("message", "")},
    )
    agent = result.get("agent")
    if agent not in AGENT_ROSTER or agent == "Emergency Escalation":
        agent = "Symptom Assessment"
    state["router_agent"] = agent
    state["router_reason"] = str(result.get("reason", ""))
    state["domain_hint"] = state.get("domain_hint") or _infer_domain(state.get("message", ""))
    _log(state, "Router", f"routed to {agent} ({state['router_reason']})", handoff_to=agent)
    return state


# ---------------------------------------------------------------------------
# Clinical Knowledge / RAG Agent
# ---------------------------------------------------------------------------

def node_rag(state: GraphState) -> GraphState:
    query = state.get("message", "")
    domain_hint = state.get("domain_hint") or _infer_domain(query)
    result = rag_service.retrieve(
        query,
        domain_hint=domain_hint,
        population_hint=state.get("population_hint"),
        top_k=2,
    )
    state["evidence"] = [
        {
            "chunk_id": it.chunk_id,
            "source_id": it.source_id,
            "domain": it.domain,
            "text": it.text,
            "similarity": it.similarity,
            "source_title": it.source_title,
            "source_url": it.source_url,
            "evidence_tier": it.evidence_tier,
            "limitations": it.limitations,
        }
        for it in result.items
    ]
    state["evidence_note"] = result.note
    _log(state, "Clinical Knowledge / RAG", f"{len(state['evidence'])} evidence item(s), sufficient={result.sufficient}")
    return state


# ---------------------------------------------------------------------------
# Specialist Agents
# ---------------------------------------------------------------------------

def node_symptom_agent(state: GraphState) -> GraphState:
    prompt = (
        "You are NARI's Clinical Symptom Assessment Specialist for women's health.\n"
        "You are having a conversation, not writing a report. Use a two-step intake pattern and pick ONE step "
        "for this reply:\n\n"
        "STEP 1 - CLARIFY FIRST (default for a new or vague symptom): If the conversation so far - including "
        "earlier turns - doesn't already tell you the symptom's severity, how long it's lasted, whether it "
        "tracks with a cycle phase, and anything alongside it, do NOT produce the full causes/relief/red-flag "
        "breakdown yet. Instead: briefly and warmly acknowledge what they shared, then ask 2-4 short, specific "
        "questions to fill those gaps (e.g. severity 0-10, onset/duration, timing vs. their cycle, associated "
        "symptoms, what they've already tried). Keep this reply short and conversational, a few sentences, not "
        "a workup. Do not skip this step just because the symptom sounds familiar.\n\n"
        "STEP 2 - FULL ASSESSMENT (only once you have that detail, from this message or earlier turns): Give a "
        "direct, comprehensive, empathetic, medically informative response covering:\n"
        "1. Most Likely Causes & Mechanisms: Explain clearly, grounded in what they told you, what physiological "
        "factors could be causing this symptom (e.g., uterine prostaglandins, dysmenorrhea, cycle phase hormonal "
        "shifts, pelvic muscle tension, endometriosis, ovarian cysts, or gastrointestinal overlap).\n"
        "2. Immediate Practical Relief: Give actionable, evidence-based home care steps (heat therapy, hydration, "
        "gentle pelvic stretches, anti-inflammatory foods, magnesium/omega-3, rest).\n"
        "3. Red Flag Warnings: Explain what specific signs require seeing a doctor promptly (sudden severe pain, "
        "high fever, abnormal bleeding, pain radiating down legs, vomiting).\n"
        "4. Tone: Warm, clear, structured with concise bullet points.\n\n"
        "Exception: if the message already reads as urgent or the user has clearly already given full detail "
        "unprompted, you may go straight to STEP 2.\n"
        'Respond as JSON: {"reply": string, "urgency_flag": "monitor"|"none"}. '
        '"reply" MUST be one plain string containing your entire message to the user (use \\n and markdown-style '
        "bullets inside that string for structure) - never a nested object, and never split STEP 2's sections "
        "into separate top-level JSON keys."
    )
    result = complete_json(
        prompt,
        _build_agent_messages(state),
        temperature=0.3,
        mock_key="symptom_agent",
        mock_context={"message": state.get("message", "")},
    )
    state["reply"] = str(result.get("reply", ""))
    _log(state, "Symptom Assessment", state["reply"])
    return state


def node_lab_agent(state: GraphState) -> GraphState:
    metrics = (state.get("structured_context") or {}).get("recent_lab_metrics", [])
    prompt = (
        "You are NARI's Laboratory & Biomarker Interpretation Specialist for women's health.\n"
        "Explain lab results in clear, plain language with direct, actionable context:\n"
        "1. What the biomarker measures and what high/low levels physiologically signify (e.g. ferritin, TSH, hemoglobin, hormones).\n"
        "2. Practical dietary, lifestyle, and supportive measures to discuss with a clinician.\n"
        "3. Clear questions the patient should bring to their doctor at their next visit.\n"
        'Respond as JSON: {"reply": string, "attention_flag": boolean}.'
    )
    result = complete_json(
        prompt,
        _build_agent_messages(state),
        temperature=0.2,
        mock_key="lab_agent",
        mock_context={"metrics": metrics},
    )
    state["reply"] = str(result.get("reply", ""))
    _log(state, "Laboratory Report Interpretation", state["reply"])
    return state


def node_nutrition_agent(state: GraphState) -> GraphState:
    prompt = (
        "You are NARI's Women's Nutrition & Metabolic Specialist.\n"
        "Provide personalized, highly practical, and evidence-grounded nutritional guidance:\n"
        "1. Specific nutrient-dense foods to incorporate (with options for both vegetarian and non-vegetarian diets).\n"
        "2. Nutrient synergy & absorption tips (e.g., pairing iron with Vitamin C; spacing caffeine away from minerals).\n"
        "3. Foods to minimize that might exacerbate inflammation, cramps, or insulin resistance.\n"
        'Respond as JSON: {"reply": string, "goal": string}.'
    )
    result = complete_json(
        prompt,
        _build_agent_messages(state),
        temperature=0.3,
        mock_key="nutrition_agent",
        mock_context={"evidence": state.get("evidence", [])},
    )
    state["reply"] = str(result.get("reply", ""))
    _log(state, "Nutrition Planning", state["reply"])
    return state


def node_mental_wellness_agent(state: GraphState) -> GraphState:
    prompt = (
        "You are NARI's Mental Wellness & Stress Support Specialist for women's health.\n"
        "Provide compassionate, validating support and practical nervous-system regulation techniques:\n"
        "1. Validate their feelings with empathy and explain the hormonal/stress connection (cortisol, progesterone shifts).\n"
        "2. Offer 1-2 immediate somatic/grounding exercises (e.g., box breathing 4-4-4-4, progressive muscle relaxation).\n"
        "3. Suggest gentle restorative habits and encourage reaching out to trusted support or a professional if overwhelmed.\n"
        'Respond as JSON: {"reply": string, "escalation_flag": boolean}.'
    )
    result = complete_json(
        prompt,
        _build_agent_messages(state),
        temperature=0.4,
        mock_key="mental_wellness_agent",
        mock_context={"message": state.get("message", "")},
    )
    state["reply"] = str(result.get("reply", ""))
    _log(state, "Mental Wellness Support", state["reply"])
    return state


def node_medication_agent(state: GraphState) -> GraphState:
    prompt = (
        "You are NARI's Medication & Adherence Specialist for women's health.\n"
        "Provide clear information on medication timing, food interactions, and daily adherence strategies.\n"
        "Do not prescribe or modify dosages; guide the user on safe administration and discussing changes with their doctor.\n"
        'Respond as JSON: {"reply": string}.'
    )
    result = complete_json(
        prompt,
        _build_agent_messages(state),
        temperature=0.2,
        mock_key="medication_agent",
        mock_context={},
    )
    state["reply"] = str(result.get("reply", ""))
    _log(state, "Medication & Adherence", state["reply"])
    return state


def node_lifestyle_agent(state: GraphState) -> GraphState:
    prompt = (
        "You are NARI's Holistic Lifestyle & Habit Coach for women.\n"
        "Provide achievable, high-impact daily habits tailored to their energy levels, sleep quality, and cycle phase.\n"
        "Focus on sustainable small wins (circadian rhythm, hydration, movement adjustments).\n"
        'Respond as JSON: {"reply": string}.'
    )
    result = complete_json(
        prompt,
        _build_agent_messages(state),
        temperature=0.3,
        mock_key="lifestyle_agent",
        mock_context={},
    )
    state["reply"] = str(result.get("reply", ""))
    _log(state, "Lifestyle Coaching", state["reply"])
    return state


def node_appointment_agent(state: GraphState) -> GraphState:
    prompt = (
        "You are NARI's Appointment & Care Navigation Specialist.\n"
        "Help the patient prepare for their doctor's visit: list key questions to ask, symptoms to log beforehand, and relevant records to bring.\n"
        'Respond as JSON: {"reply": string}.'
    )
    result = complete_json(
        prompt,
        _build_agent_messages(state),
        temperature=0.2,
        mock_key="appointment_agent",
        mock_context={},
    )
    state["reply"] = str(result.get("reply", ""))
    _log(state, "Appointment Management", state["reply"])
    return state


def node_document_agent(state: GraphState) -> GraphState:
    state["reply"] = (
        "I can extract structured information once a document is uploaded via Reports - medications, "
        "dates and values will be added to your timeline automatically."
    )
    _log(state, "Medical Document Intelligence", state["reply"])
    return state


def node_clinical_knowledge_agent(state: GraphState) -> GraphState:
    prompt = (
        "You are NARI's Clinical Knowledge Specialist. Synthesize guideline-backed evidence into a clear, direct, and accessible explanation for the user.\n"
        'Respond as JSON: {"reply": string}.'
    )
    result = complete_json(
        prompt,
        _build_agent_messages(state),
        temperature=0.3,
        mock_key="clinical_knowledge_agent",
        mock_context={"evidence": state.get("evidence", [])},
    )
    state["reply"] = str(result.get("reply", ""))
    _log(state, "Clinical Knowledge Retrieval", state["reply"])
    return state


_SPECIALIST_NODES = {
    "Symptom Assessment": node_symptom_agent,
    "Laboratory Report Interpretation": node_lab_agent,
    "Nutrition Planning": node_nutrition_agent,
    "Mental Wellness Support": node_mental_wellness_agent,
    "Medication & Adherence": node_medication_agent,
    "Lifestyle Coaching": node_lifestyle_agent,
    "Appointment Management": node_appointment_agent,
    "Medical Document Intelligence": node_document_agent,
    "Clinical Knowledge Retrieval": node_clinical_knowledge_agent,
    "Risk Prediction": node_symptom_agent,
}


def dispatch_specialist(state: GraphState) -> str:
    """Conditional-edge selector used by graph.py."""
    agent = state.get("router_agent", "Symptom Assessment")
    return agent if agent in _SPECIALIST_NODES else "Symptom Assessment"


# ---------------------------------------------------------------------------
# Risk Prediction Agent (Heuristic pattern evaluator)
# ---------------------------------------------------------------------------

def node_risk_check(state: GraphState) -> GraphState:
    ctx = state.get("structured_context") or {}
    domain = state.get("domain_hint")
    output = None

    if domain == "PCOS":
        output = risk_engine.evaluate_pcos_pattern(
            cycle_lengths_days=ctx.get("cycle_lengths_days"), symptoms=ctx.get("symptoms")
        )
    elif domain == "Endometriosis":
        output = risk_engine.evaluate_endometriosis_pattern(
            pain_severity=ctx.get("pain_severity"),
            pain_cycle_related=bool(ctx.get("pain_cycle_related")),
            heavy_bleeding=bool(ctx.get("heavy_bleeding")),
            bowel_or_urinary_symptoms=bool(ctx.get("bowel_or_urinary_symptoms")),
        )
    elif domain == "Mental Wellbeing" and state.get("router_agent") == "Mental Wellness Support":
        output = risk_engine.evaluate_mental_wellbeing_trend(
            mood_scores=ctx.get("mood_scores"), stress_scores=ctx.get("stress_scores"), crisis_language=False
        )
    elif ctx.get("recent_lab_metrics"):
        output = risk_engine.evaluate_lab_trend_flag(ctx["recent_lab_metrics"])

    if output and output.fired:
        state["risk_signal"] = {
            "domain": output.domain,
            "signal_type": output.signal_type,
            "level": output.level,
            "factors": output.factors,
            "confidence_note": output.confidence_note,
            "next_step": output.next_step,
            "when_to_seek_care": output.when_to_seek_care,
            "model_version": "rule-based-heuristic-v1",
        }
        if output.level in {"L2", "L3"}:
            state["escalation_level"] = output.level
        _log(state, "Risk Prediction", f"{output.domain} pattern flag fired at {output.level}")
    else:
        state["risk_signal"] = None
    return state


# ---------------------------------------------------------------------------
# Care Plan Agent
# ---------------------------------------------------------------------------

def node_careplan(state: GraphState) -> GraphState:
    risk = state.get("risk_signal")
    evidence = state.get("evidence", [])
    plan: dict[str, Any] = {
        "summary": state.get("reply", ""),
        "agent": state.get("router_agent"),
        "observed_factors": risk["factors"] if risk else [],
        "why_flagged": (
            f"Pattern-based flag ({risk['signal_type']}) at escalation level {risk['level']} - "
            f"{risk['confidence_note']}"
            if risk
            else None
        ),
        "evidence": [
            {"text": e["text"], "source": e["source_title"], "url": e.get("source_url")} for e in evidence[:2]
        ],
        "next_step": risk["next_step"] if risk else None,
        "when_to_seek_care": risk["when_to_seek_care"] if risk else None,
    }
    state["care_plan"] = plan
    _log(state, "Care Plan", "composed explainable care-plan card")
    return state


# ---------------------------------------------------------------------------
# Follow-up Care Agent
# ---------------------------------------------------------------------------

def node_followup(state: GraphState) -> GraphState:
    risk = state.get("risk_signal")
    if risk and risk["level"] in {"L1", "L2"}:
        due = date.today() + timedelta(days=7 if risk["level"] == "L2" else 14)
        state["follow_up"] = {
            "reason": f"Check whether the {risk['domain']} pattern noted on {date.today().isoformat()} has changed.",
            "due_date": due.isoformat(),
            "related_agent": "Risk Prediction",
        }
        _log(state, "Follow-up Care", f"follow-up scheduled for {due.isoformat()}")
    else:
        state["follow_up"] = None
    return state