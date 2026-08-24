from __future__ import annotations

from pydantic import BaseModel


class PaginationMeta(BaseModel):
    """Shared pagination envelope - used by ReportListResponse today, and
    intended for any other future list endpoint."""

    page: int
    page_size: int
    total: int
    total_pages: int
