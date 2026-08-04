from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.enums import SheetPriority, SheetStatus
from app.schemas.common import normalize_entity_name


class ImportedSheetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    position: int
    card_count: int


class WorkbookImportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    original_filename: str
    sheet_count: int
    total_cards: int
    imported_at: datetime
    sheets: list[ImportedSheetResponse]


class WorkbookListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    original_filename: str
    sheet_count: int
    total_cards: int
    imported_at: datetime


class SheetSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    position: int
    card_count: int
    status: SheetStatus
    priority: SheetPriority
    next_review_at: datetime | None


class WorkbookDetail(WorkbookListItem):
    sheets: list[SheetSummary]


class WorkbookUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return normalize_entity_name(value)


class WorkbookReference(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
