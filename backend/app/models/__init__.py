"""Database model registration for ORM and Alembic metadata discovery."""

from app.models.enums import (
    NotificationType,
    SheetPriority,
    SheetStatus,
    SrsRating,
    StudyDirection,
    StudyRoundCardResult,
    StudyRoundScope,
    StudyRoundStatus,
    StudySessionStatus,
    StudySessionType,
)
from app.models.flashcard import Flashcard
from app.models.notification import Notification
from app.models.study_sheet import StudySheet
from app.models.study_session import StudySession
from app.models.study_session_card import StudySessionCard
from app.models.study_session_round import StudySessionRound
from app.models.study_session_round_card import StudySessionRoundCard
from app.models.workbook import Workbook

__all__ = [
    "Flashcard",
    "Notification",
    "NotificationType",
    "SheetPriority",
    "SheetStatus",
    "SrsRating",
    "StudyDirection",
    "StudyRoundCardResult",
    "StudyRoundScope",
    "StudyRoundStatus",
    "StudySession",
    "StudySessionCard",
    "StudySessionRound",
    "StudySessionRoundCard",
    "StudySessionStatus",
    "StudySessionType",
    "StudySheet",
    "Workbook",
]
