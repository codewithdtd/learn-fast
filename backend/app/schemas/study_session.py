from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict

from app.models.enums import (
    StudyDirection,
    StudyRoundCardResult,
    StudyRoundScope,
    StudyRoundStatus,
    StudySessionStatus,
    StudySessionType,
)


class StudyAnswerDirection(StrEnum):
    EN_TO_VI = "en_to_vi"
    VI_TO_EN = "vi_to_en"


class StudyAnswerResult(StrEnum):
    REMEMBERED = "remembered"
    AGAIN = "again"


class StudySessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sheet_id: int
    session_type: StudySessionType
    direction: StudyDirection


class StudySessionCardFlashcard(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    position: int
    phrase: str
    meaning: str
    example_en: str | None
    example_vi: str | None
    is_weak: bool
    is_bookmarked: bool


class StudySessionCardDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    flashcard_id: int
    direction: StudyDirection | None
    attempt_count: int
    again_count: int
    remembered: bool
    first_try_correct: bool
    last_answered_at: datetime | None
    flashcard: StudySessionCardFlashcard


class StudySessionRoundCardDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_card_id: int
    position: int
    result: StudyRoundCardResult | None
    answered_at: datetime | None
    session_card: StudySessionCardDetail


class StudySessionRoundSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    round_number: int
    scope: StudyRoundScope
    status: StudyRoundStatus
    total_cards: int
    remembered_count: int
    again_count: int
    recall_percentage: float | None
    completed_at: datetime | None


class StudySessionRoundDetail(StudySessionRoundSummary):
    started_at: datetime
    source_round_id: int | None
    round_cards: list[StudySessionRoundCardDetail]


class StudySessionDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sheet_id: int
    session_type: StudySessionType
    direction: StudyDirection
    status: StudySessionStatus
    started_at: datetime
    completed_at: datetime | None
    total_cards: int
    total_attempts: int
    first_try_correct: int
    again_count: int
    mastery_score: float | None
    sheet_rating: str | None
    session_cards: list[StudySessionCardDetail]
    active_round: StudySessionRoundDetail | None
    round_summaries: list[StudySessionRoundSummary]


class StudySessionAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    direction: StudyAnswerDirection
    result: StudyAnswerResult


class StudySessionAnswerResponse(BaseModel):
    session_id: int
    card_id: int
    direction: StudyAnswerDirection
    result: StudyAnswerResult
    attempt_count: int
    again_count: int
    remembered: bool
    first_try_correct: bool
    total_attempts: int
    session_again_count: int
    session_first_try_correct: int
    remaining_cards: int


class StudySessionRoundCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scope: StudyRoundScope
