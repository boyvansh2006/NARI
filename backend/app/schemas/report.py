from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.responses import PaginationMeta


class ReportRead(BaseModel):
    """Full representation of a stored report, including the parsed
    biomarker JSON. Returned from upload/get (single-report) endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID | None = None
    original_filename: str
    patient_demographics_found: bool
    report_json: dict[str, Any]
    uploaded_at: datetime


class ReportListItem(BaseModel):
    """Lightweight representation for list views - omits the parsed
    biomarker JSON so listing reports stays cheap."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    original_filename: str
    patient_demographics_found: bool
    uploaded_at: datetime


class ReportUploadResponse(BaseModel):
    message: str
    report: ReportRead


class ReportDetailResponse(BaseModel):
    message: str
    report: ReportRead


class ReportListResponse(BaseModel):
    items: list[ReportListItem]
    pagination: PaginationMeta


class ReportDeleteResponse(BaseModel):
    message: str
    report_id: UUID