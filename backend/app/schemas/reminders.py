from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReminderCreate(BaseModel):
    """
    Schema used when creating a new medication reminder.
    """

    name: str
    dose: str | None = None
    time: str
    frequency: str = "Once daily"


class ReminderUpdate(BaseModel):
    """
    Schema used when updating an existing medication reminder.

    All fields are optional so the API can update only the values
    that were provided by the client.
    """

    name: str | None = None
    dose: str | None = None
    time: str | None = None
    frequency: str | None = None


class ReminderRead(BaseModel):
    """
    Schema returned when reading a medication reminder.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    dose: str | None = None
    time: str
    frequency: str
    taken_log: dict = Field(default_factory=dict)


class ReminderWriteResponse(BaseModel):
    """
    Standard response returned after creating or updating
    a medication reminder.
    """

    reminder: ReminderRead
    warnings: list[str] = Field(default_factory=list)