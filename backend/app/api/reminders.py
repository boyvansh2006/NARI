from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id
from app.database.database import get_db_session
from app.database.models import MedicationReminder
from app.schemas.reminders import ReminderCreate, ReminderRead

router = APIRouter(prefix="/api/v1/reminders", tags=["reminders"])


@router.get("", response_model=list[ReminderRead])
async def list_reminders(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> list[MedicationReminder]:
    rows = (
        await session.execute(
            select(MedicationReminder)
            .where(MedicationReminder.patient_id == user_id)
            .order_by(MedicationReminder.created_at.desc())
        )
    ).scalars().all()
    return list(rows)


@router.post("", response_model=ReminderRead)
async def create_reminder(
    payload: ReminderCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> MedicationReminder:
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
    return reminder


@router.post("/{reminder_id}/toggle", response_model=ReminderRead)
async def toggle_reminder(
    reminder_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> MedicationReminder:
    reminder = (
        await session.execute(
            select(MedicationReminder).where(
                MedicationReminder.id == reminder_id, MedicationReminder.patient_id == user_id
            )
        )
    ).scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    today = date.today().isoformat()
    log = dict(reminder.taken_log or {})
    log[today] = not log.get(today, False)
    reminder.taken_log = log
    await session.commit()
    await session.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}")
async def delete_reminder(
    reminder_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    reminder = (
        await session.execute(
            select(MedicationReminder).where(
                MedicationReminder.id == reminder_id, MedicationReminder.patient_id == user_id
            )
        )
    ).scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    await session.delete(reminder)
    await session.commit()
    return {"message": "deleted", "id": str(reminder_id)}