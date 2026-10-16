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
    is_ai_generated: bool = False


class WorkbookDetail(WorkbookListItem):
    sheets: list[SheetSummary]


class WorkbookUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return normalize_entity_name(value)


class MoveSheetsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_workbook_id: int
    sheet_ids: list[int]

    @field_validator("sheet_ids")
    @classmethod
    def validate_sheet_ids(cls, value: list[int]) -> list[int]:
        if not value:
            raise ValueError("At least one sheet must be selected.")
        if len(value) != len(set(value)):
            raise ValueError("Duplicate sheet IDs are not allowed.")
        return value


class MoveSheetsResponse(BaseModel):
    moved_count: int
    source_workbook_id: int
    target_workbook_id: int


class WorkbookReference(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
