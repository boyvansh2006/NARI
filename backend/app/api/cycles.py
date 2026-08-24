from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id
from app.database.database import get_db_session
from app.database.models import MenstrualCycle
from app.schemas.cycle import (
    CycleAnalytics,
    MenstrualCycleCreate,
    MenstrualCycleRead,
    MenstrualCycleUpdate,
)

router = APIRouter(prefix="/api/v1/cycles", tags=["cycles"])


@router.get("", response_model=List[MenstrualCycleRead])
async def list_cycles(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> List[MenstrualCycle]:
    """Retrieve all securely tracked menstrual cycle logs for the authenticated user."""
    stmt = (
        select(MenstrualCycle)
        .where(MenstrualCycle.patient_id == user_id)
        .order_by(desc(MenstrualCycle.start_date))
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=MenstrualCycleRead, status_code=status.HTTP_201_CREATED)
async def create_cycle_log(
    payload: MenstrualCycleCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> MenstrualCycle:
    """Securely log a new menstrual cycle/period entry for the authenticated user."""
    cycle = MenstrualCycle(
        id=uuid.uuid4(),
        patient_id=user_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        cycle_length_days=payload.cycle_length_days,
        flow=payload.flow,
        pain_severity=payload.pain_severity,
        symptoms=payload.symptoms,
        source=payload.source or "user",
    )
    session.add(cycle)
    await session.commit()
    await session.refresh(cycle)
    return cycle


@router.patch("/{cycle_id}", response_model=MenstrualCycleRead)
async def update_cycle_log(
    cycle_id: uuid.UUID,
    payload: MenstrualCycleUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> MenstrualCycle:
    """Update an existing period/cycle entry owned by the authenticated user."""
    stmt = select(MenstrualCycle).where(
        MenstrualCycle.id == cycle_id,
        MenstrualCycle.patient_id == user_id,
    )
    cycle = (await session.execute(stmt)).scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cycle record not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cycle, field, value)

    await session.commit()
    await session.refresh(cycle)
    return cycle


@router.delete("/{cycle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cycle_log(
    cycle_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Securely delete a period log entry owned by the authenticated user."""
    stmt = select(MenstrualCycle).where(
        MenstrualCycle.id == cycle_id,
        MenstrualCycle.patient_id == user_id,
    )
    cycle = (await session.execute(stmt)).scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cycle record not found")

    await session.delete(cycle)
    await session.commit()


@router.get("/analytics", response_model=CycleAnalytics)
async def get_cycle_analytics(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> CycleAnalytics:
    """Computes cycle phase, predicted period start, and fertility insights based on secure historical logs."""
    stmt = (
        select(MenstrualCycle)
        .where(MenstrualCycle.patient_id == user_id)
        .order_by(desc(MenstrualCycle.start_date))
    )
    cycles = list((await session.execute(stmt)).scalars().all())

    today = date.today()

    if not cycles:
        # Default placeholder analytics when no logs exist yet
        return CycleAnalytics(
            current_day=1,
            current_phase="Follicular Phase",
            phase_description="Your body is building energy and estrogen levels gradually rise.",
            comfort_tip="Stay well hydrated and include gentle movement or stretching.",
            avg_cycle_length=28,
            avg_period_duration=5,
            last_period_date=None,
            next_period_date=today + timedelta(days=14),
            ovulation_date=today + timedelta(days=7),
            fertile_window_start=today + timedelta(days=2),
            fertile_window_end=today + timedelta(days=8),
            total_logs=0,
            regularity_score="Awaiting logs",
        )

    # Calculate average cycle length & duration
    lengths = []
    durations = []
    for i in range(len(cycles) - 1):
        diff = (cycles[i].start_date - cycles[i + 1].start_date).days
        if 20 <= diff <= 45:
            lengths.append(diff)

    for c in cycles:
        if c.end_date and c.end_date >= c.start_date:
            dur = (c.end_date - c.start_date).days + 1
            if 1 <= dur <= 12:
                durations.append(dur)

    avg_cycle = int(sum(lengths) / len(lengths)) if lengths else 28
    avg_period = int(sum(durations) / len(durations)) if durations else 5

    last_cycle = cycles[0]
    days_since_start = (today - last_cycle.start_date).days + 1
    current_day = max(1, days_since_start)

    # Determine Phase
    if current_day <= avg_period:
        phase = "Menstrual Phase"
        desc = "Your period is active. Uterine lining is shedding and hormone levels are at baseline."
        tip = "Prioritize warmth, soothing herbal teas, rest, and iron-rich meals."
    elif current_day < (avg_cycle - 14):
        phase = "Follicular Phase"
        desc = "Estrogen is rising, supporting higher physical stamina, mental clarity, and collagen synthesis."
        tip = "Great time for active workouts, complex problem solving, and fresh antioxidant-rich foods."
    elif current_day <= (avg_cycle - 12):
        phase = "Ovulation Phase"
        desc = "Luteinizing hormone (LH) peaks, releasing a mature egg. Peak energy and high metabolism."
        tip = "Incorporate fiber, hydration, and light cardio to support hormonal balance."
    else:
        phase = "Luteal Phase"
        desc = "Progesterone rises to support the uterine lining. Body temperature rises slightly."
        tip = "Focus on grounding foods (magnesium, complex carbohydrates), gentle yoga, and restorative sleep."

    next_period = last_cycle.start_date + timedelta(days=avg_cycle)
    ovulation_date = last_cycle.start_date + timedelta(days=max(1, avg_cycle - 14))
    fertile_start = ovulation_date - timedelta(days=5)
    fertile_end = ovulation_date + timedelta(days=1)

    regularity = "Regular" if (not lengths or (max(lengths) - min(lengths) <= 4)) else "Moderate Variance"

    return CycleAnalytics(
        current_day=current_day,
        current_phase=phase,
        phase_description=desc,
        comfort_tip=tip,
        avg_cycle_length=avg_cycle,
        avg_period_duration=avg_period,
        last_period_date=last_cycle.start_date,
        next_period_date=next_period,
        ovulation_date=ovulation_date,
        fertile_window_start=fertile_start,
        fertile_window_end=fertile_end,
        total_logs=len(cycles),
        regularity_score=regularity,
    )
