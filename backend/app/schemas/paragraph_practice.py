from typing import Literal

from pydantic import Field, field_validator

from app.schemas.writing import StrictModel


class ParagraphPracticeCreate(StrictModel):
    sheet_id: int = Field(gt=0)
    card_ids: list[int] = Field(min_length=5, max_length=10)
    style: Literal["paragraph", "dialogue"]

    @field_validator("card_ids")
    @classmethod
    def validate_card_ids(cls, value: list[int]) -> list[int]:
        if any(card_id <= 0 for card_id in value) or len(set(value)) != len(value):
            raise ValueError("Choose 5 to 10 different vocabulary cards.")
        return value


class ParagraphWord(StrictModel):
    id: int = Field(gt=0)
    phrase: str = Field(min_length=1, max_length=200)
    meaning: str = Field(min_length=1, max_length=600)


class ParagraphWordUse(StrictModel):
    id: int = Field(gt=0)
    vietnamese_excerpt: str = Field(min_length=1, max_length=180)


class AIParagraphTask(StrictModel):
    title_en: str = Field(min_length=2, max_length=160)
    title_vi: str = Field(min_length=2, max_length=160)
    paragraph_vi: str = Field(min_length=30, max_length=2000)
    word_uses: list[ParagraphWordUse] = Field(min_length=5, max_length=10)


class ParagraphGuestTask(StrictModel):
    sheet_id: int = Field(gt=0)
    title_en: str = Field(min_length=2, max_length=160)
    title_vi: str = Field(min_length=2, max_length=160)
    paragraph_vi: str = Field(min_length=30, max_length=2000)
    style: Literal["paragraph", "dialogue"]
    words: list[ParagraphWord] = Field(min_length=5, max_length=10)


class ParagraphGuestGrade(StrictModel):
    task: ParagraphGuestTask
    draft_text: str = Field(min_length=1, max_length=4000)
