from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import SheetPriority, SheetStatus
from app.schemas.workbook import SheetSummary, WorkbookReference


class SheetDetail(SheetSummary):
    first_learned_at: datetime | None
    last_reviewed_at: datetime | None
    srs_level: int
    interval_days: int
    review_count: int
    lapse_count: int
    workbook: WorkbookReference


class SheetUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    priority: SheetPriority
