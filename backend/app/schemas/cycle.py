from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class MenstrualCycleCreate(BaseModel):
    start_date: date
    end_date: date | None = None
    cycle_length_days: int | None = None
    flow: str | None = Field(default=None, description="Spotting, Light, Medium, Heavy")
    pain_severity: int | None = Field(default=None, ge=0, le=10)
    symptoms: str | None = None
    source: str = "user"

    @model_validator(mode="after")
    def _validate_date_range(self) -> "MenstrualCycleCreate":
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class MenstrualCycleUpdate(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    cycle_length_days: int | None = None
    flow: str | None = None
    pain_severity: int | None = Field(default=None, ge=0, le=10)
    symptoms: str | None = None

    @model_validator(mode="after")
    def _validate_date_range(self) -> "MenstrualCycleUpdate":
        # Only meaningful when both are present in the same partial update -
        # a patch that only changes one side is checked against the
        # existing row instead, in api/cycles.py's update_cycle_log.
        if self.start_date is not None and self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class MenstrualCycleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    start_date: date
    end_date: date | None = None
    cycle_length_days: int | None = None
    flow: str | None = None
    pain_severity: int | None = None
    symptoms: str | None = None
    source: str = "user"
    created_at: datetime


class CycleAnalytics(BaseModel):
    current_day: int
    current_phase: str
    phase_description: str
    comfort_tip: str
    avg_cycle_length: int
    avg_period_duration: int
    last_period_date: date | None
    next_period_date: date | None
    ovulation_date: date | None
    fertile_window_start: date | None
    fertile_window_end: date | None
    total_logs: int
    regularity_score: str
