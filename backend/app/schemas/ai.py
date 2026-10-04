from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import normalize_entity_name


class AIGeneratedCardItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    phrase: str
    meaning: str
    example_en: str
    example_vi: str

    @field_validator("phrase", "meaning", "example_en", "example_vi")
    @classmethod
    def strip_whitespace(cls, value: str) -> str:
        return value.strip()


class AIGenerateRequest(BaseModel):
    topic: Optional[str] = None
    count: int = Field(default=10, ge=5, le=40)
    level: str = Field(default="Intermediate B1-B2")
    target_sheet_id: Optional[int] = None
    target_workbook_id: Optional[int] = None


class AIMineRequest(BaseModel):
    text: str = Field(..., min_length=5, max_length=3000)
    target_sheet_id: Optional[int] = None
    target_workbook_id: Optional[int] = None

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        trimmed = value.strip()
        if len(trimmed) < 5:
            raise ValueError("Source text must contain at least 5 characters.")
        return trimmed


class AIGeneratedSheetResponse(BaseModel):
    sheet_name: str
    cards: list[AIGeneratedCardItem]
    total_generated: int


class AISaveSheetRequest(BaseModel):
    mode: Literal["new_sheet", "append"] = "new_sheet"
    workbook_id: Optional[int] = None
    new_workbook_name: Optional[str] = None
    target_sheet_id: Optional[int] = None
    sheet_name: str
    cards: list[AIGeneratedCardItem]

    @field_validator("sheet_name")
    @classmethod
    def validate_sheet_name(cls, value: str) -> str:
        return normalize_entity_name(value)

    @field_validator("new_workbook_name")
    @classmethod
    def validate_workbook_name(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value.strip():
            return normalize_entity_name(value)
        return None


class AISaveSheetResponse(BaseModel):
    workbook_id: int
    workbook_name: str
    sheet_id: int
    sheet_name: str
    cards_added: int
    total_cards: int
    is_appended: bool
