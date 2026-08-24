from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id
from app.core.exceptions import ReminderNotFoundError
from app.database.database import get_db_session
from app.database.models import MedicationReminder
from app.schemas.reminders import ReminderCreate, ReminderRead, ReminderUpdate, ReminderWriteResponse
from app.services import interaction_service

router = APIRouter(prefix="/api/v1/reminders", tags=["reminders"])


async def _get_owned_reminder(
    session: AsyncSession, reminder_id: uuid.UUID, user_id: uuid.UUID
) -> MedicationReminder:
    reminder = (
        await session.execute(
            select(MedicationReminder).where(
                MedicationReminder.id == reminder_id, MedicationReminder.patient_id == user_id
            )
        )
    ).scalar_one_or_none()
    if reminder is None:
        raise ReminderNotFoundError()
    return reminder


@router.get("", response_model=list[ReminderRead])
async def list_reminders(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> list[MedicationReminder]:
    rows = (
        await session.execute(
            select(MedicationReminder)
            .where(MedicationReminder.patient_id == user_id)
            .order_by(MedicationReminder.time.asc())
        )
    ).scalars().all()
    return list(rows)


@router.post("", response_model=ReminderWriteResponse, status_code=201)
async def create_reminder(
    payload: ReminderCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> ReminderWriteResponse:
    existing_names = (
        await session.execute(
            select(MedicationReminder.name).where(MedicationReminder.patient_id == user_id)
        )
    ).scalars().all()
    warnings = interaction_service.evaluate_new_reminder(payload.name, list(existing_names))

    reminder = MedicationReminder(
        id=uuid.uuid4(),
        patient_id=user_id,
        name=payload.name,
        dose=payload.dose,
        time=payload.time,
        frequency=payload.frequency,
        taken_log={},
    )
    session.add(reminder)
    await session.commit()
    await session.refresh(reminder)

    return ReminderWriteResponse(
        reminder=ReminderRead.model_validate(reminder, from_attributes=True), warnings=warnings
    )


@router.patch("/{reminder_id}", response_model=ReminderWriteResponse)
async def update_reminder(
    reminder_id: uuid.UUID,
    payload: ReminderUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> ReminderWriteResponse:
    """
    GGSIPU2617 extension - audit fix ("No edit endpoint - only
    create/toggle/delete ... users [had to] delete-and-recreate to fix a
    typo or time"). All fields optional; only provided fields are updated.
    """
    reminder = await _get_owned_reminder(session, reminder_id, user_id)

    warnings: list[str] = []
    if payload.name is not None and payload.name != reminder.name:
        other_names = (
            await session.execute(
                select(MedicationReminder.name).where(
                    MedicationReminder.patient_id == user_id, MedicationReminder.id != reminder_id
                )
            )
        ).scalars().all()
        warnings = interaction_service.evaluate_new_reminder(payload.name, list(other_names))
        reminder.name = payload.name
    if payload.dose is not None:
        reminder.dose = payload.dose
    if payload.time is not None:
        reminder.time = payload.time
    if payload.frequency is not None:
        reminder.frequency = payload.frequency

    await session.commit()
    await session.refresh(reminder)
    return ReminderWriteResponse(
        reminder=ReminderRead.model_validate(reminder, from_attributes=True), warnings=warnings
    )


@router.post("/{reminder_id}/toggle", response_model=ReminderRead)
async def toggle_reminder(
    reminder_id: uuid.UUID,
    log_date: str | None = None,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> MedicationReminder:
    from datetime import date as date_cls

    reminder = await _get_owned_reminder(session, reminder_id, user_id)
    key = log_date or date_cls.today().isoformat()
    taken_log = dict(reminder.taken_log or {})
    taken_log[key] = not taken_log.get(key, False)
    reminder.taken_log = taken_log

    await session.commit()
    await session.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}", response_model=ReminderRead)
async def delete_reminder(
    reminder_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> MedicationReminder:
    reminder = await _get_owned_reminder(session, reminder_id, user_id)
    await session.delete(reminder)
    await session.commit()
    return reminder