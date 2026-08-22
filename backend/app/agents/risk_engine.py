"""
Risk Prediction Agent's scoring engine.

READ THIS BEFORE EXTENDING: the team's own research
(PR - Model Readiness sheet) checked every disease-specific use case in
GGSIPU2617's problem statement - PCOS, endometriosis, pregnancy, fertility,
postpartum, menopause, mental wellbeing, chronic conditions - against
"Ready to Train?" and the answer is "No" for every single one, because no
validated dataset/label/population-fit/clinical-review has happened yet
(also Dataset Requirements sheet: every row is "Not started"). Chapter 3 of
Research_Vanshika.docx makes the same point: "prediction aur diagnosis
same nahi hain" (prediction and diagnosis are not the same thing), and a
model can only produce a clinical-sounding output once it is actually
validated against real data with clinical sign-off - never before.

So this module deliberately does NOT contain a trained/fitted ML
classifier, and does not claim to. What it contains instead is a small set
of transparent, fully-inspectable heuristic pattern-matchers - the kind of
"count red flags in structured features, weight them, return which ones
fired" rule engine you can read top to bottom - each one clearly labeled
`model_version="rule-based-heuristic-v1"` (see RiskSignal model) rather
than a fabricated version like "pcos-classifier-v1" that would misrepresent
it as a validated model. This is intentional and mirrors SRAI - Safety
Framework's "Diagnosis boundary": no autonomous diagnosis, ever - and
PR - Model Readiness's own "Next research action" column (verify dataset
provenance, labels, features and population before training anything).

To upgrade a domain from heuristic to a real model: get a validated
dataset + label + population fit + clinical sign-off (see
PR - Model Readiness's "Next research action" per domain), train/calibrate
a model with proper evaluation, then swap that domain's function below for
a call into your trained model - RiskOutput's shape doesn't need to change.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

ESCALATION_LEVELS = {
    "L0": "General information / self-management",
    "L1": "Monitor",
    "L2": "Clinical consultation",
    "L3": "Urgent / emergency",
    "L4": "System safety stop",
}


@dataclass
class RiskOutput:
    domain: str
    signal_type: str
    level: str  # L0..L4
    factors: list[str] = field(default_factory=list)
    confidence_note: str = "Rule-based pattern flag, not a validated diagnostic or ML model."
    next_step: str = ""
    when_to_seek_care: str = ""
    fired: bool = False


def evaluate_pcos_pattern(
    *,
    cycle_lengths_days: list[int] | None = None,
    symptoms: list[str] | None = None,
) -> RiskOutput:
    """Heuristic PCOS-pattern flag from cycle irregularity + reported
    symptoms - see PR - Model Readiness / PCOS sheet: "Candidate features:
    cycle irregularity; relevant symptoms; ... Ready to Train? No"."""
    cycle_lengths_days = cycle_lengths_days or []
    symptoms = [s.lower() for s in (symptoms or [])]
    factors: list[str] = []

    irregular = False
    if len(cycle_lengths_days) >= 2:
        spread = max(cycle_lengths_days) - min(cycle_lengths_days)
        if spread >= 9 or any(length > 35 or length < 21 for length in cycle_lengths_days):
            irregular = True
            factors.append(f"Cycle length varied by {spread} days across recent logged cycles")

    symptom_hits = [s for s in ("acne", "excess hair growth", "hirsutism", "weight gain", "hair thinning") if s in symptoms]
    factors.extend(f"Reported symptom: {s}" for s in symptom_hits)

    if irregular and symptom_hits:
        return RiskOutput(
            domain="PCOS", signal_type="pattern_flag", level="L2", factors=factors, fired=True,
            next_step="This combination of irregular cycles and reported symptoms is worth discussing with a gynecologist or endocrinologist.",
            when_to_seek_care="Sooner if periods stop entirely, or if you notice rapid weight change or worsening symptoms.",
        )
    if irregular or symptom_hits:
        return RiskOutput(
            domain="PCOS", signal_type="pattern_flag", level="L1", factors=factors, fired=True,
            next_step="Keep logging cycles and symptoms - a clearer pattern over 2-3 more cycles will make a clinical conversation more useful.",
            when_to_seek_care="If new symptoms appear or existing ones worsen.",
        )
    return RiskOutput(domain="PCOS", signal_type="pattern_flag", level="L0", fired=False)


def evaluate_endometriosis_pattern(
    *,
    pain_severity: int | None = None,
    pain_cycle_related: bool = False,
    heavy_bleeding: bool = False,
    bowel_or_urinary_symptoms: bool = False,
) -> RiskOutput:
    """Heuristic clinical-review flag - see Endometriosis sheet: "Symptoms
    alone do not establish diagnosis"."""
    factors: list[str] = []
    score = 0
    if pain_severity is not None and pain_severity >= 7:
        score += 2
        factors.append(f"Self-reported pain severity {pain_severity}/10")
    elif pain_severity is not None and pain_severity >= 4:
        score += 1
        factors.append(f"Self-reported pain severity {pain_severity}/10")
    if pain_cycle_related:
        score += 1
        factors.append("Pain reported as linked to menstrual cycle")
    if heavy_bleeding:
        score += 1
        factors.append("Heavy bleeding reported")
    if bowel_or_urinary_symptoms:
        score += 1
        factors.append("Bowel or urinary symptoms reported alongside pelvic pain")

    if score >= 3:
        return RiskOutput(
            domain="Endometriosis", signal_type="clinical_review_flag", level="L2", factors=factors, fired=True,
            next_step="This symptom pattern is worth a gynecological evaluation - pain severity alone doesn't confirm a cause, but it's persistent/multi-symptom enough to flag.",
            when_to_seek_care="Sooner if pain becomes sudden/severe, or you develop fever or fainting.",
        )
    if score >= 1:
        return RiskOutput(
            domain="Endometriosis", signal_type="clinical_review_flag", level="L1", factors=factors, fired=True,
            next_step="Keep tracking pain timing, severity and associated symptoms across your next cycle.",
            when_to_seek_care="If pain escalates or starts interfering with daily activities.",
        )
    return RiskOutput(domain="Endometriosis", signal_type="clinical_review_flag", level="L0", fired=False)


def evaluate_mental_wellbeing_trend(
    *,
    mood_scores: list[int] | None = None,
    stress_scores: list[int] | None = None,
    crisis_language: bool = False,
) -> RiskOutput:
    """Heuristic wellbeing-trend flag - see Mental Wellbeing sheet: "Crisis
    pathway is separately controlled; AI is not a substitute for
    professional care". Crisis language always overrides to L3 regardless
    of trend, handled by the emergency node before this ever runs."""
    if crisis_language:
        return RiskOutput(
            domain="Mental Wellbeing", signal_type="crisis_flag", level="L3", fired=True,
            factors=["Message contained crisis-related language"],
            next_step="Immediate safety check-in and crisis resources.",
            when_to_seek_care="Now.",
        )
    mood_scores = mood_scores or []
    stress_scores = stress_scores or []
    factors = []
    declining = len(mood_scores) >= 3 and mood_scores[-1] < mood_scores[0] - 2
    high_stress = len(stress_scores) >= 3 and sum(stress_scores[-3:]) / 3 >= 7
    if declining:
        factors.append("Mood trend declining over recent check-ins")
    if high_stress:
        factors.append("Stress level has averaged high (>=7/10) over recent check-ins")
    if declining and high_stress:
        return RiskOutput(
            domain="Mental Wellbeing", signal_type="trend_flag", level="L2", factors=factors, fired=True,
            next_step="This trend is worth discussing with a counsellor or your clinician.",
            when_to_seek_care="Immediately if you ever have thoughts of harming yourself.",
        )
    if declining or high_stress:
        return RiskOutput(
            domain="Mental Wellbeing", signal_type="trend_flag", level="L1", factors=factors, fired=True,
            next_step="Keep checking in - support (breathing exercises, journaling, talking to someone you trust) may help meanwhile.",
            when_to_seek_care="If things feel worse or unmanageable.",
        )
    return RiskOutput(domain="Mental Wellbeing", signal_type="trend_flag", level="L0", fired=False)


def evaluate_lab_trend_flag(metrics: list[dict]) -> RiskOutput:
    """Simple, transparent flag for a batch of lab metrics -> not a
    diagnosis, just "here's what's outside range and worth a look"."""
    abnormal = [m for m in metrics if str(m.get("status", "")).upper() in {"HIGH", "LOW"}]
    if not abnormal:
        return RiskOutput(domain="Laboratory", signal_type="trend_flag", level="L0", fired=False)
    factors = [f"{m.get('biomarker_name', 'value')}: {m.get('value', '')} {m.get('unit', '') or ''} ({m.get('status')})" for m in abnormal]
    level = "L2" if len(abnormal) >= 3 else "L1"
    return RiskOutput(
        domain="Laboratory", signal_type="trend_flag", level=level, factors=factors, fired=True,
        next_step="Share this report with your clinician for interpretation in context of your full history.",
        when_to_seek_care="Sooner if these values come with symptoms like severe fatigue, dizziness, or bleeding.",
    )