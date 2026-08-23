from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict


class MealEntry(BaseModel):
    text: str
    time: str


class ActivityLogUpsert(BaseModel):
    water: float | None = None
    sleep_hours: float | None = None
    steps: int | None = None
    exercise_minutes: int | None = None
    mood: str | None = None
    weight: str | None = None
    meals: list[MealEntry] | None = None


class ActivityLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    log_date: date
    water: float
    sleep_hours: float
    steps: int
    exercise_minutes: int
    mood: str | None
    weight: str | None
    meals: list[dict]