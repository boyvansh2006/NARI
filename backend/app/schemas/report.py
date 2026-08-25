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
    """Representation for list views.

    BUG FIX: this used to omit `report_json` entirely ("lightweight...
    omits the parsed biomarker JSON so listing reports stays cheap"), but
    frontend/src/App.jsx's report list rendering reads
    `r.report_json?.metrics` on every item returned from GET /reports to
    compute each row's flagged/normal status pill AND to populate the
    biomarker chart when a row is clicked - both silently no-opped (always
    "All Normal Range", chart never opened) because that field was always
    undefined here. Reports are small, per-user JSON blobs, not a
    high-volume list, so the perf tradeoff this was optimizing for isn't
    worth the broken UI - include the full parsed JSON, matching ReportRead.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    original_filename: str
    patient_demographics_found: bool
    report_json: dict[str, Any]
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