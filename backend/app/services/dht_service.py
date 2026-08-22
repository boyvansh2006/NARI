"""
Digital Health Twin context builder.

app/agents/graph.py's `structured_context` input is deliberately DB-agnostic
(see state.py's comment: "so agent nodes stay synchronous and DB-agnostic")
- the calling service is expected to pre-fetch whatever the Risk Prediction
Agent (app/agents/risk_engine.py) needs and hand it over as plain dicts/
lists. This module is that pre-fetch step: given a patient_id, pull the
most recent menstrual cycles, symptoms and lab results and shape them into
the exact keys risk_engine.py's evaluate_*() functions expect
(`cycle_lengths_days`, `symptoms`, `pain_severity`, `recent_lab_metrics`,
etc).

Kept intentionally small and read-only. If patient_id is None (e.g. the
frontend's current demo/anonymous flow - see App.jsx's DEMO_PROFILE, which
has no id) every query below is skipped and an empty context is returned,
so the agent graph still runs, it just won't have longitudinal data to
reason about yet.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.database.models import LabResult, MenstrualCycle, Symptom

LOGGER = get_logger(__name__)


async def build_structured_context(session: AsyncSession, patient_id: str | UUID | None) -> dict:
    """Best-effort: any DB error here should not break the chat turn, so
    failures are logged and an empty context is returned rather than
    propagated."""
    if not patient_id:
        return {}

    try:
        pid = patient_id if isinstance(patient_id, UUID) else UUID(str(patient_id))
    except (ValueError, TypeError):
        LOGGER.warning(f"Ignoring non-UUID patient_id for structured_context: {patient_id!r}")
        return {}

    context: dict = {}

    try:
        cycles = (
            await session.execute(
                select(MenstrualCycle)
                .where(MenstrualCycle.patient_id == pid)
                .order_by(MenstrualCycle.start_date.desc())
                .limit(6)
            )
        ).scalars().all()
        cycle_lengths = [c.cycle_length_days for c in cycles if c.cycle_length_days]
        if cycle_lengths:
            context["cycle_lengths_days"] = cycle_lengths
        if cycles and cycles[0].pain_severity is not None:
            context["pain_severity"] = cycles[0].pain_severity
            context["pain_cycle_related"] = True
        if cycles and cycles[0].flow and cycles[0].flow.lower() in {"heavy", "very heavy"}:
            context["heavy_bleeding"] = True

        symptoms = (
            await session.execute(
                select(Symptom)
                .where(Symptom.patient_id == pid)
                .order_by(Symptom.created_at.desc())
                .limit(10)
            )
        ).scalars().all()
        if symptoms:
            context["symptoms"] = [s.name for s in symptoms]
            if any(
                s.name and any(kw in s.name.lower() for kw in ("bowel", "urinary", "bladder"))
                for s in symptoms
            ):
                context["bowel_or_urinary_symptoms"] = True

        lab_results = (
            await session.execute(
                select(LabResult)
                .where(LabResult.patient_id == pid)
                .order_by(LabResult.created_at.desc())
                .limit(20)
            )
        ).scalars().all()
        if lab_results:
            context["recent_lab_metrics"] = [
                {
                    "biomarker_name": lr.biomarker_name,
                    "value": lr.value,
                    "unit": lr.unit,
                    "status": lr.status,
                }
                for lr in lab_results
            ]
    except Exception as exc:  # pragma: no cover - defensive, see docstring
        LOGGER.warning(f"structured_context build failed for patient_id={patient_id!r}: {exc}")
        return context

    return context
