from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class QuickRecallResult(StrEnum):
    REMEMBERED = "remembered"
    NEED_REVIEW = "need_review"


class QuickRecallCardResultInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    flashcard_id: int
    result: QuickRecallResult


class QuickRecallCompletionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    results: list[QuickRecallCardResultInput] = Field(min_length=1)

    @model_validator(mode="after")
    def reject_duplicate_flashcard_ids(self) -> "QuickRecallCompletionRequest":
        card_ids = [result.flashcard_id for result in self.results]
        if len(card_ids) != len(set(card_ids)):
            raise ValueError("Each flashcard can have only one Quick Recall result.")
        return self


class QuickRecallCompletionResponse(BaseModel):
    sheet_id: int
    total_cards: int
    remembered_count: int
    need_review_count: int
    recall_percentage: float
    completed_at: datetime
