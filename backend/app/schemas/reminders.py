from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ReminderCreate(BaseModel):
    name: str
    dose: str | None = None
    time: str
    frequency: str = "Once daily"


class ReminderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    dose: str | None
    time: str
    frequency: str
    taken_log: dict