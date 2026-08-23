from __future__ import annotations

import uuid

from fastapi import Header, HTTPException

from app.core.security import decode_access_token


async def get_current_user_id(authorization: str | None = Header(default=None)) -> uuid.UUID:
    """Extracts and validates the JWT from the Authorization header.
    Raises 401 if missing/invalid - used to protect any endpoint that
    requires a signed-in (non-guest) user."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.removeprefix("Bearer ").strip()
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired session - please sign in again")
    try:
        return uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token payload")