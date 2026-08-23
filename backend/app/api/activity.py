from __future__ import annotations

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id
from app.database.database import get_db_session
from app.database.models import DailyActivityLog
from app.schemas.activity import ActivityLogRead, ActivityLogUpsert

router = APIRouter(prefix="/api/v1/activity", tags=["activity"])


@router.get("/today", response_model=ActivityLogRead)
async def get_today_activity(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> DailyActivityLog:
    today = date.today()
    log = (
        await session.execute(
            select(DailyActivityLog).where(
                DailyActivityLog.patient_id == user_id,
                DailyActivityLog.log_date == today,
            )
        )
    ).scalar_one_or_none()

    if not log:
        # Return an unpersisted default object with 0 values
        return DailyActivityLog(
            id=uuid.uuid4(),
            patient_id=user_id,
            log_date=today,
            water=0.0,
            sleep_hours=0.0,
            steps=0,
            exercise_minutes=0,
            mood=None,
            weight=None,
            meals=[],
        )
    return log


@router.put("/today", response_model=ActivityLogRead)
async def update_today_activity(
    payload: ActivityLogUpsert,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> DailyActivityLog:
    today = date.today()
    log = (
        await session.execute(
            select(DailyActivityLog).where(
                DailyActivityLog.patient_id == user_id,
                DailyActivityLog.log_date == today,
            )
        )
    ).scalar_one_or_none()

    if not log:
        log = DailyActivityLog(
            id=uuid.uuid4(),
            patient_id=user_id,
            log_date=today,
            water=payload.water or 0.0,
            sleep_hours=payload.sleep_hours or 0.0,
            steps=payload.steps or 0,
            exercise_minutes=payload.exercise_minutes or 0,
            mood=payload.mood,
            weight=payload.weight,
            meals=[m.model_dump() for m in payload.meals] if payload.meals is not None else [],
        )
        session.add(log)
    else:
        if payload.water is not None:
            log.water = payload.water
        if payload.sleep_hours is not None:
            log.sleep_hours = payload.sleep_hours
        if payload.steps is not None:
            log.steps = payload.steps
        if payload.exercise_minutes is not None:
            log.exercise_minutes = payload.exercise_minutes
        if payload.mood is not None:
            log.mood = payload.mood
        if payload.weight is not None:
            log.weight = payload.weight
        if payload.meals is not None:
            log.meals = [m.model_dump() for m in payload.meals]

    await session.commit()
    await session.refresh(log)
    return log


@router.get("/history", response_model=list[ActivityLogRead])
async def get_activity_history(
    days: int = Query(default=7, ge=1, le=90),
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> list[DailyActivityLog]:
    start_date = date.today() - timedelta(days=days - 1)
    logs = (
        await session.execute(
            select(DailyActivityLog)
            .where(
                DailyActivityLog.patient_id == user_id,
                DailyActivityLog.log_date >= start_date,
            )
            .order_by(DailyActivityLog.log_date.asc())
        )
    ).scalars().all()

    # Map existing logs by date
    log_map = {item.log_date: item for item in logs}

    # Fill any missing dates with 0-value logs for smooth frontend charts
    result = []
    for i in range(days):
        d = start_date + timedelta(days=i)
        if d in log_map:
            result.append(log_map[d])
        else:
            result.append(
                DailyActivityLog(
                    id=uuid.uuid4(),
                    patient_id=user_id,
                    log_date=d,
                    water=0.0,
                    sleep_hours=0.0,
                    steps=0,
                    exercise_minutes=0,
                    mood=None,
                    weight=None,
                    meals=[],
                )
            )
    return result
