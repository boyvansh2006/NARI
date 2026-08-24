from __future__ import annotations

from pydantic import BaseModel


class GoogleFitAuthUrlResponse(BaseModel):
    auth_url: str


class GoogleFitStatusResponse(BaseModel):
    connected: bool
    