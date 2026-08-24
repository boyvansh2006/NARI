"""
Minimal Google Fit OAuth + step-count fetch, using plain httpx calls
(no google-auth-oauthlib dependency needed - one less thing to install).

Flow:
  1. build_auth_url() -> user is redirected to Google's consent screen.
  2. exchange_code() -> called from the OAuth callback with the ?code
     Google appends, swaps it for access_token + refresh_token.
  3. fetch_today_steps() -> calls the Fitness REST API's aggregate
     endpoint for the current day's step count.
  4. refresh_access_token() -> called automatically when the stored
     token has expired, using the long-lived refresh_token.

NOTE: Google has been migrating wearable/activity data toward Health
Connect (Android) and may retire parts of this REST API for new
integrations - verify current status at
https://developers.google.com/fit before relying on this in production.
"""
from __future__ import annotations

import urllib.parse
from datetime import datetime, timedelta, timezone

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

LOGGER = get_logger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
FITNESS_AGGREGATE_URL = "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate"

SCOPES = [
    "https://www.googleapis.com/auth/fitness.activity.read",
    "https://www.googleapis.com/auth/fitness.sleep.read",
]


def build_auth_url(state: str) -> str:
    settings = get_settings()
    params = {
        "client_id": settings.google_fit_client_id,
        "redirect_uri": settings.google_fit_redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",   # needed to get a refresh_token
        "prompt": "consent",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"


async def exchange_code(code: str) -> dict:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_fit_client_id,
                "client_secret": settings.google_fit_client_secret,
                "redirect_uri": settings.google_fit_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        resp.raise_for_status()
        return resp.json()  # {access_token, refresh_token, expires_in, ...}


async def refresh_access_token(refresh_token: str) -> dict:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "refresh_token": refresh_token,
                "client_id": settings.google_fit_client_id,
                "client_secret": settings.google_fit_client_secret,
                "grant_type": "refresh_token",
            },
        )
        resp.raise_for_status()
        return resp.json()  # {access_token, expires_in, ...} (no new refresh_token)


async def fetch_today_steps(access_token: str) -> int:
    """Aggregates com.google.step_count.delta for the current calendar day
    and returns the total step count as an int (0 if no data)."""
    now = datetime.now(timezone.utc)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)

    body = {
        "aggregateBy": [{"dataTypeName": "com.google.step_count.delta"}],
        "bucketByTime": {"durationMillis": 86_400_000},
        "startTimeMillis": int(start_of_day.timestamp() * 1000),
        "endTimeMillis": int(now.timestamp() * 1000),
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            FITNESS_AGGREGATE_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()

    total = 0
    for bucket in data.get("bucket", []):
        for dataset in bucket.get("dataset", []):
            for point in dataset.get("point", []):
                for value in point.get("value", []):
                    total += int(value.get("intVal", 0))
    return total


def expiry_from_expires_in(expires_in: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=int(expires_in) - 60)  # 60s safety margin