from __future__ import annotations

import base64
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.deps import get_current_user_id
from app.core.logging import get_logger
from app.database.database import get_db_session
from app.database.models import DailyActivityLog, GoogleFitToken
from app.schemas.activity import ActivityLogRead
from app.schemas.google_fit import GoogleFitAuthUrlResponse, GoogleFitStatusResponse
from app.services import google_fit_service

LOGGER = get_logger(__name__)
router = APIRouter(prefix="/api/v1/googlefit", tags=["google-fit"])


def _encode_state(user_id: uuid.UUID) -> str:
    return base64.urlsafe_b64encode(str(user_id).encode()).decode()


def _decode_state(state: str) -> uuid.UUID:
    return uuid.UUID(base64.urlsafe_b64decode(state.encode()).decode())


@router.get("/status", response_model=GoogleFitStatusResponse)
async def status(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> GoogleFitStatusResponse:
    row = (
        await session.execute(select(GoogleFitToken).where(GoogleFitToken.patient_id == user_id))
    ).scalar_one_or_none()
    return GoogleFitStatusResponse(connected=row is not None)


@router.get("/connect", response_model=GoogleFitAuthUrlResponse)
async def connect(user_id: uuid.UUID = Depends(get_current_user_id)) -> GoogleFitAuthUrlResponse:
    """Called by the frontend (with its JWT) to get the Google consent URL.
    The frontend then does window.location.assign(auth_url) itself, since
    a plain browser navigation can't carry an Authorization header."""
    state = _encode_state(user_id)
    return GoogleFitAuthUrlResponse(auth_url=google_fit_service.build_auth_url(state))


@router.get("/callback")
async def callback(
    code: str = Query(...),
    state: str = Query(...),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    """Google redirects the browser here directly (no auth header available).
    We recover the user id from the signed `state` param, exchange the code,
    store tokens, then bounce the browser back to the frontend."""
    settings = get_settings()
    try:
        user_id = _decode_state(state)
        token_data = await google_fit_service.exchange_code(code)

        existing = (
            await session.execute(select(GoogleFitToken).where(GoogleFitToken.patient_id == user_id))
        ).scalar_one_or_none()

        expires_at = google_fit_service.expiry_from_expires_in(token_data["expires_in"])
        refresh_token = token_data.get("refresh_token") or (existing.refresh_token if existing else "")

        if existing:
            existing.access_token = token_data["access_token"]
            existing.refresh_token = refresh_token
            existing.expires_at = expires_at
        else:
            session.add(
                GoogleFitToken(
                    patient_id=user_id,
                    access_token=token_data["access_token"],
                    refresh_token=refresh_token,
                    expires_at=expires_at,
                )
            )
        await session.commit()
        redirect_target = f"{settings.frontend_base_url}/?fit=connected#activity"
    except Exception as exc:
        LOGGER.warning(f"Google Fit callback failed: {exc}")
        redirect_target = f"{settings.frontend_base_url}/?fit=error#activity"

    return RedirectResponse(url=redirect_target)


@router.post("/sync", response_model=ActivityLogRead)
async def sync(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> DailyActivityLog:
    """Pulls today's step count from Google Fit and writes it into the
    same DailyActivityLog table the manual tracker UI uses, so it shows
    up in the same steps ring automatically."""
    from datetime import datetime, timezone

    token_row = (
        await session.execute(select(GoogleFitToken).where(GoogleFitToken.patient_id == user_id))
    ).scalar_one_or_none()
    if not token_row:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="Google Fit is not connected for this account")

    access_token = token_row.access_token
    if token_row.expires_at <= datetime.now(timezone.utc):
        refreshed = await google_fit_service.refresh_access_token(token_row.refresh_token)
        access_token = refreshed["access_token"]
        token_row.access_token = access_token
        token_row.expires_at = google_fit_service.expiry_from_expires_in(refreshed["expires_in"])
        await session.commit()

    steps = await google_fit_service.fetch_today_steps(access_token)

    today = date.today()
    activity_row = (
        await session.execute(
            select(DailyActivityLog).where(
                DailyActivityLog.patient_id == user_id, DailyActivityLog.log_date == today
            )
        )
    ).scalar_one_or_none()
    if not activity_row:
        activity_row = DailyActivityLog(patient_id=user_id, log_date=today, meals=[])
        session.add(activity_row)

    activity_row.steps = steps
    await session.commit()
    await session.refresh(activity_row)
    return activity_row
