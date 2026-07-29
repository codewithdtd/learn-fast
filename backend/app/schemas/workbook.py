from datetime import datetime

from pydantic import BaseModel, ConfigDict


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
