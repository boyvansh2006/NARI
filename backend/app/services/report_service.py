from __future__ import annotations

from math import ceil
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import DatabaseOperationError, InvalidDocumentError, ReportNotFoundError
from app.core.logging import get_logger
from app.core.security import validate_report_upload
from app.database.models import LabResult, Report
from app.schemas.report import (
    ReportDeleteResponse,
    ReportDetailResponse,
    ReportListItem,
    ReportListResponse,
    ReportRead,
    ReportUploadResponse,
)
from app.schemas.responses import PaginationMeta
from app.services.parser_service import ParserService
from app.utils.files import sanitize_filename

LOGGER = get_logger(__name__)


class ReportService:
    """
    Reused from Vitalis's ReportService: upload -> temp file -> parse ->
    persist -> cleanup. The Supabase Storage upload step is dropped (this
    build keeps things local-disk-only for a zero-config dev setup); swap
    _save_upload_to_tempfile/_cleanup_tempfile for a real object-storage
    client if you want uploaded files retained beyond parsing.
    """

    def __init__(self, session: AsyncSession, parser_service: ParserService | None = None) -> None:
        self.session = session
        self.parser_service = parser_service or ParserService()
        self.settings = get_settings()

    async def upload_report(self, upload_file: UploadFile, user_id: UUID | None = None) -> ReportUploadResponse:
        kind = await validate_report_upload(upload_file)

        report_id = uuid4()
        original_filename = sanitize_filename(upload_file.filename or f"report.{kind}")
        storage_path = f"local/reports/{report_id}/{original_filename}"
        temp_path: Path | None = None

        try:
            temp_path = await self._save_upload_to_tempfile(upload_file, original_filename)
            parsed_data = await self.parser_service.parse_document(temp_path, kind)
            raw_json_data = parsed_data.model_dump()

            report = Report(
                id=report_id,
                user_id=user_id,
                original_filename=original_filename,
                storage_path=storage_path,
                patient_demographics_found=bool(raw_json_data.get("patient_demographics_found", False)),
                report_json=raw_json_data,
            )

            self.session.add(report)
            await self._sync_lab_results(report_id, user_id, raw_json_data)
            await self.session.commit()
            await self.session.refresh(report)

            LOGGER.info(
                "Stored parsed report JSON",
                extra={"report_id": str(report.id), "storage_path": report.storage_path},
            )
            return ReportUploadResponse(
                message="Report uploaded and parsed successfully",
                report=self._to_schema(report, ReportRead),
            )
        except Exception as exc:
            await self.session.rollback()
            if hasattr(exc, "status_code"):
                raise
            if isinstance(exc, SQLAlchemyError):
                raise DatabaseOperationError(str(exc)) from exc
            raise
        finally:
            if temp_path is not None:
                self._cleanup_tempfile(temp_path)

    async def _sync_lab_results(self, report_id: UUID, user_id: UUID | None, raw_json_data: dict) -> None:
        """Normalization step flagged as missing by database/models.py's
        LabResult docstring ("do not store all extracted clinical
        information only as an opaque JSON blob" - GGSIPU2617_Vitalis_
        Features_and_Recommended_Architecture.pdf section 14): mirrors each
        biomarker from the parser's `metrics` list into its own LabResult
        row, keyed to this report and (if known) this patient, so the Risk
        Prediction Agent / Laboratory Agent (see services/dht_service.py,
        app/agents/risk_engine.py) can query, trend and compare individual
        biomarkers across uploads instead of only reading opaque per-upload
        JSON. Best-effort: a malformed metric is skipped, not fatal to the
        whole upload.
        """
        metrics = raw_json_data.get("metrics") or []
        if not isinstance(metrics, list):
            return
        for metric in metrics:
            if not isinstance(metric, dict):
                continue
            name = str(metric.get("biomarker_name") or "").strip()
            if not name:
                continue
            self.session.add(
                LabResult(
                    patient_id=user_id,
                    report_id=report_id,
                    biomarker_name=name,
                    extracted_abbreviation=metric.get("extracted_abbreviation"),
                    value=str(metric.get("value", "")),
                    unit=metric.get("unit"),
                    status=str(metric.get("status") or "UNSPECIFIED").upper(),
                    verification_state="ai_extracted",
                )
            )

    async def get_report(self, report_id: UUID) -> ReportDetailResponse:
        report = await self._fetch_report_or_404(report_id)
        return ReportDetailResponse(message="Report retrieved successfully", report=self._to_schema(report, ReportRead))

    async def list_reports(self, page: int = 1, page_size: int = 20) -> ReportListResponse:
        offset = (page - 1) * page_size
        total = int((await self.session.execute(select(func.count()).select_from(Report))).scalar_one())

        statement = select(Report).order_by(Report.uploaded_at.desc()).offset(offset).limit(page_size)
        rows = (await self.session.execute(statement)).scalars().all()
        total_pages = ceil(total / page_size) if total else 0

        return ReportListResponse(
            items=[self._to_schema(report, ReportListItem) for report in rows],
            pagination=PaginationMeta(page=page, page_size=page_size, total=total, total_pages=total_pages),
        )

    async def delete_report(self, report_id: UUID) -> ReportDeleteResponse:
        report = await self._fetch_report_or_404(report_id)
        try:
            await self.session.delete(report)
            await self.session.commit()
        except SQLAlchemyError as exc:
            await self.session.rollback()
            raise DatabaseOperationError(str(exc)) from exc
        return ReportDeleteResponse(message="Report deleted successfully", report_id=report_id)

    async def _fetch_report_or_404(self, report_id: UUID) -> Report:
        statement = select(Report).where(Report.id == report_id)
        report = (await self.session.execute(statement)).scalar_one_or_none()
        if report is None:
            raise ReportNotFoundError()
        return report

    def _to_schema(self, report: Report, schema_type: type[ReportRead] | type[ReportListItem]):
        return schema_type.model_validate(report, from_attributes=True)

    async def _save_upload_to_tempfile(self, upload_file: UploadFile, original_filename: str) -> Path:
        self.settings.uploads_dir.mkdir(parents=True, exist_ok=True)
        suffix = Path(original_filename).suffix or ".pdf"
        temp_path = self.settings.uploads_dir / f"{uuid4()}{suffix}"
        max_bytes = self.settings.max_upload_size_mb * 1024 * 1024
        bytes_written = 0

        try:
            with temp_path.open("wb") as temp_handle:
                while chunk := await upload_file.read(1024 * 1024):
                    bytes_written += len(chunk)
                    if bytes_written > max_bytes:
                        raise InvalidDocumentError(
                            f"Uploaded file exceeds the maximum allowed size of {self.settings.max_upload_size_mb} MB"
                        )
                    temp_handle.write(chunk)
        except Exception:
            if temp_path.exists():
                temp_path.unlink()
            raise
        finally:
            await upload_file.seek(0)

        return temp_path

    def _cleanup_tempfile(self, temp_path: Path) -> None:
        try:
            if temp_path.exists():
                temp_path.unlink()
        except OSError as exc:
            LOGGER.warning("Failed to delete temporary file", extra={"temp_path": str(temp_path), "error": str(exc)})