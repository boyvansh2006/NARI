from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func

class Base(DeclarativeBase):
    pass


class GUID(TypeDecorator):
    """
    Portable UUID column: native UUID on Postgres, CHAR(36) on SQLite.
    Vitalis's original models.py used postgres.UUID directly, which only
    works against Postgres - this makes the same Report model work against
    the SQLite default too.
    """

    impl = CHAR(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID as PG_UUID

            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return str(value)
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return uuid.UUID(str(value))


class Report(Base):
    """
    Reused from Vitalis's database/models.py Report table - the parent
    table for uploaded lab reports, storing the parser's structured JSON
    output directly rather than a fully normalized schema.
    """

    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True, index=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(1024), nullable=False, unique=True)
    patient_demographics_found: Mapped[bool] = mapped_column(default=False)

    report_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    # GGSIPU2617 extension: distinguishes lab reports from prescriptions /
    # consultation notes / discharge summaries so the Medical Document
    # Intelligence Agent and Digital Health Twin can route each kind
    # correctly instead of treating every upload as a lab report.
    document_type: Mapped[str] = mapped_column(String(50), nullable=False, default="lab_report")

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
    )


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# GGSIPU2617 extension: normalized Digital Health Twin schema.
#
# Vitalis/Aarogya's baseline only had `Report` (an opaque JSON blob per
# upload). The GGSIPU2617 feature/architecture research explicitly flags
# "do not store all extracted clinical information only as an opaque JSON
# blob; normalize important measurements" (see
# GGSIPU2617_Vitalis_Features_and_Recommended_Architecture.pdf, section 14,
# and EPGA - Data Schema / EPGA - Gap Analysis in the team's research
# spreadsheets). The tables below are that normalization layer, plus the
# supporting tables the Multi-Agent System, Digital Health Twin, RAG and
# Safety/Escalation layers need (see MAS - Data Contracts, DHT - Digital
# Health Twin, SRAI - Escalation Matrix, MER - Source Registry sheets).
# ---------------------------------------------------------------------------


class User(Base):
    """Authentication identity. Kept deliberately minimal (email + role) -
    see README "Known gaps" for what a production auth system would add
    (email verification, password reset, MFA, session/refresh tokens)."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    # "patient" | "clinician" - see SRAI - Safety Framework's RBAC requirement.
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="patient")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class PatientProfile(Base):
    """Identity & Preferences + baseline reproductive-context layer of the
    Digital Health Twin (DHT - Digital Health Twin sheet, row 1-2). One row
    per patient user; id == users.id."""

    __tablename__ = "patient_profiles"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), primary_key=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    biological_sex: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # e.g. Menstrual / Pregnancy / Postpartum / Menopause (Feature Dictionary F002)
    life_stage: Mapped[str | None] = mapped_column(String(50), nullable=True)
    conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    medications_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    allergies: Mapped[str | None] = mapped_column(Text, nullable=True)
    goals: Mapped[str | None] = mapped_column(Text, nullable=True)
    sleep_hours_baseline: Mapped[float | None] = mapped_column(Float, nullable=True)
    exercise_frequency: Mapped[str | None] = mapped_column(String(100), nullable=True)
    language_preference: Mapped[str] = mapped_column(String(20), nullable=False, default="en")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class Symptom(Base):
    """Symptoms & Events layer of the DHT (see DHT sheet row 3). Structured
    rather than free text so the Risk/Follow-up agents can query it."""

    __tablename__ = "symptoms"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    severity: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0-10, Feature F005
    duration_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    onset_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    cycle_relation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    associated_symptoms: Mapped[str | None] = mapped_column(Text, nullable=True)
    red_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    # user | agent_inferred | clinician - provenance requirement (SRAI - Safety Framework)
    source: Mapped[str] = mapped_column(String(30), default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class MenstrualCycle(Base):
    """Reproductive Context layer of the DHT. Not present at all in the
    Vitalis baseline (EPGA - Gap Analysis: "Add: Menstrual Tracking")."""

    __tablename__ = "menstrual_cycles"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), index=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    cycle_length_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    flow: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pain_severity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    symptoms: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(30), default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class LabResult(Base):
    """Normalized per-biomarker row extracted from a Report.report_json blob
    (or entered directly). This is the fix for "do not store all extracted
    clinical information only as an opaque JSON blob" - individual
    biomarkers can now be queried/trended/compared across dates instead of
    only living inside a per-upload JSON document."""

    __tablename__ = "lab_results"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True, index=True)
    report_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("reports.id"), nullable=True, index=True)
    biomarker_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    extracted_abbreviation: Mapped[str | None] = mapped_column(String(50), nullable=True)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="UNSPECIFIED")
    reference_range: Mapped[str | None] = mapped_column(String(100), nullable=True)
    test_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    extraction_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    # ai_extracted | user_confirmed | clinician_confirmed - DHT trust model
    verification_state: Mapped[str] = mapped_column(String(30), default="ai_extracted")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Medication(Base):
    """Medications layer of the DHT (treatment context, adherence, source)."""

    __tablename__ = "medications"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    dose: Mapped[str | None] = mapped_column(String(100), nullable=True)
    frequency: Mapped[str | None] = mapped_column(String(100), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    prescriber: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("reports.id"), nullable=True)
    adherence_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | completed | stopped
    reported_side_effects: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class LifestyleRecord(Base):
    """Lifestyle + Sleep layers of the DHT."""

    __tablename__ = "lifestyle_records"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), index=True)
    record_date: Mapped[date] = mapped_column(Date, nullable=False)
    sleep_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    activity_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    water_liters: Mapped[float | None] = mapped_column(Float, nullable=True)
    mood: Mapped[str | None] = mapped_column(String(50), nullable=True)
    stress_level: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0-10
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(30), default="user")  # user | wearable
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class WearableMetric(Base):
    """Wearable & Sensor Data layer of the DHT. GGSIPU2617's problem
    statement expects Health Connect/Google Fit integration; this table is
    the storage side of that pipeline. Ingestion in this pass is a manual
    import endpoint (see services/wearable_service.py) rather than a live
    OAuth connection - see README for why and what a real integration needs."""

    __tablename__ = "wearable_metrics"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), index=True)
    metric_type: Mapped[str] = mapped_column(String(50), nullable=False)  # steps | sleep_hours | heart_rate | ...
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[str] = mapped_column(String(50), default="manual_import")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class EvidenceSource(Base):
    """MER - Source Registry: the governed evidence corpus the RAG agent
    retrieves from. Seeded at startup from app/data/knowledge_base.py.
    Kept as a real table (not just a config file) so citations returned to
    the user can be joined back to full source metadata."""

    __tablename__ = "evidence_sources"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # e.g. "SRC-W04"
    domain: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    organization: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    source_type: Mapped[str] = mapped_column(String(100), nullable=False)
    scope: Mapped[str] = mapped_column(String(50), default="Global")
    publication_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    evidence_tier: Mapped[int] = mapped_column(Integer, default=3)  # 1 = highest (WHO/national guideline)
    topics: Mapped[str | None] = mapped_column(Text, nullable=True)
    url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    limitations: Mapped[str | None] = mapped_column(Text, nullable=True)
    verification_status: Mapped[str] = mapped_column(String(50), default="Verify before production ingestion")


class RiskSignal(Base):
    """Risk & Assessment History layer of the DHT. IMPORTANT: per the
    team's own PR - Model Readiness research, no disease-specific model in
    this project is dataset-validated yet ("Ready to Train? No" for every
    domain). So `model_version` here is a transparent rule-based pattern
    matcher, never a trained/validated ML classifier - see
    app/agents/risk_engine.py docstring."""

    __tablename__ = "risk_signals"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), index=True)
    domain: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "PCOS pattern"
    signal_type: Mapped[str] = mapped_column(String(100), nullable=False)
    level: Mapped[str] = mapped_column(String(5), nullable=False)  # L0..L4, SRAI - Escalation Matrix
    factors: Mapped[list[Any]] = mapped_column(JSON, default=list)
    evidence_refs: Mapped[list[Any]] = mapped_column(JSON, default=list)
    confidence_note: Mapped[str] = mapped_column(Text, nullable=False)
    next_step: Mapped[str | None] = mapped_column(Text, nullable=True)
    when_to_seek_care: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_version: Mapped[str] = mapped_column(String(50), default="rule-based-heuristic-v1")
    status: Mapped[str] = mapped_column(String(20), default="open")  # open | reviewed | dismissed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class CarePlan(Base):
    """Care & Follow-up layer of the DHT: the Care Plan Agent's combined,
    explainable output."""

    __tablename__ = "care_plans"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), index=True)
    goals: Mapped[list[Any]] = mapped_column(JSON, default=list)
    recommendations: Mapped[list[Any]] = mapped_column(JSON, default=list)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    follow_up_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class FollowUpTask(Base):
    """Follow-up Care Agent's task queue - continuity across visits/agents."""

    __tablename__ = "follow_up_tasks"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | done | skipped
    related_agent: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Appointment(Base):
    """Appointment Management Agent's records."""

    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), index=True)
    specialty: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="requested")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class AgentEventLog(Base):
    """Auditability requirement (SRAI - Safety Framework: "Important
    decisions must be reconstructable"). One row per agent hop in the
    orchestration graph for a given conversation turn."""

    __tablename__ = "agent_event_logs"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True, index=True)
    agent: Mapped[str] = mapped_column(String(100), nullable=False)
    input_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    handoff_to: Mapped[str | None] = mapped_column(String(100), nullable=True)
    urgent: Mapped[bool] = mapped_column(Boolean, default=False)
    escalation_level: Mapped[str | None] = mapped_column(String(5), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    class MedicationReminder(Base):
    """A patient's recurring medication reminder, with a per-day taken/not
    log so the frontend can show "taken today" without a separate table."""

    __tablename__ = "medication_reminders"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    dose: Mapped[str | None] = mapped_column(String(100), nullable=True)
    time: Mapped[str] = mapped_column(String(5), nullable=False)  # "HH:MM"
    frequency: Mapped[str] = mapped_column(String(50), default="Once daily")
    # {"2026-08-23": true, "2026-08-24": false, ...}
    taken_log: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class DailyActivityLog(Base):
    """One row per patient per calendar day - water, sleep, steps, exercise,
    mood, weight and free-text meals. Mirrors the HealthifyMe-style tracker
    UI (frontend/src/ActivityTrackerPage.jsx)."""

    __tablename__ = "daily_activity_logs"
    __table_args__ = (UniqueConstraint("patient_id", "log_date", name="uq_activity_patient_date"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), index=True)
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    water: Mapped[float] = mapped_column(Float, default=0)
    sleep_hours: Mapped[float] = mapped_column(Float, default=0)
    steps: Mapped[int] = mapped_column(Integer, default=0)
    exercise_minutes: Mapped[int] = mapped_column(Integer, default=0)
    mood: Mapped[str | None] = mapped_column(String(30), nullable=True)
    weight: Mapped[str | None] = mapped_column(String(20), nullable=True)
    meals: Mapped[list] = mapped_column(JSON, default=list)  # [{"text": "...", "time": "..."}]
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)