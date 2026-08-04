from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.models.enums import SheetPriority, SheetStatus
from app.schemas.common import normalize_entity_name
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

    name: str | None = None
    priority: SheetPriority | None = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return normalize_entity_name(value)

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "SheetUpdate":
        if self.name is None and self.priority is None:
            raise ValueError("At least one sheet field must be provided.")
        return self
