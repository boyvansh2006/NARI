from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_optional_user_id
from app.core.logging import get_logger
from app.database.database import get_db_session
from app.schemas.report import (
    ReportDeleteResponse,
    ReportDetailResponse,
    ReportListResponse,
    ReportUploadResponse,
)
from app.services.report_service import ReportService

LOGGER = get_logger(__name__)

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


@router.post("/upload", response_model=ReportUploadResponse)
async def upload_report(
    file: UploadFile = File(...),
    user_id: UUID | None = Depends(get_optional_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> ReportUploadResponse:
    """Matches frontend/src/api.js's uploadReport(): POST multipart/form-data
    with a single "file" field -> ReportService's upload -> parse -> persist
    pipeline."""
    return await ReportService(session).upload_report(file, user_id=user_id)


@router.get("", response_model=ReportListResponse)
async def list_reports(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user_id: UUID | None = Depends(get_optional_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> ReportListResponse:
    """Matches frontend/src/api.js's listReports(page, pageSize)."""
    return await ReportService(session).list_reports(page=page, page_size=page_size, user_id=user_id)


@router.get("/{report_id}", response_model=ReportDetailResponse)
async def get_report(
    report_id: UUID,
    user_id: UUID | None = Depends(get_optional_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> ReportDetailResponse:
    return await ReportService(session).get_report(report_id, user_id=user_id)


@router.delete("/{report_id}", response_model=ReportDeleteResponse)
async def delete_report(
    report_id: UUID,
    user_id: UUID | None = Depends(get_optional_user_id),
    session: AsyncSession = Depends(get_db_session),
) -> ReportDeleteResponse:
    """Matches frontend/src/api.js's deleteReport(reportId)."""
    return await ReportService(session).delete_report(report_id, user_id=user_id)
