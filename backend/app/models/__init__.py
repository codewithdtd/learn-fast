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
from app.models.guest_ai_usage import GuestAIUsage
from app.models.ielts_source import IELTSPracticeSource
from app.models.ielts_test_set import IELTSPracticeTestSet
from app.models.ielts_attempt import IELTSPracticeAttempt
from app.models.notification import Notification
from app.models.study_sheet import StudySheet
from app.models.study_session import StudySession
from app.models.study_session_card import StudySessionCard
from app.models.study_session_round import StudySessionRound
from app.models.study_session_round_card import StudySessionRoundCard
from app.models.speaking_attempt import SpeakingAttempt
from app.models.speaking_prompt import SpeakingPrompt
from app.models.speaking_usage import SpeakingAIUsage
from app.models.user import User
from app.models.workbook import Workbook
from app.models.writing_attempt import WritingAttempt
from app.models.writing_prompt import WritingPrompt
from app.models.writing_usage import WritingAIUsage

__all__ = [
    "Flashcard",
    "GuestAIUsage",
    "IELTSPracticeSource",
    "IELTSPracticeTestSet",
    "IELTSPracticeAttempt",
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
    "SpeakingAIUsage",
    "SpeakingAttempt",
    "SpeakingPrompt",
    "StudySheet",
    "User",
    "Workbook",
    "WritingAIUsage",
    "WritingAttempt",
    "WritingPrompt",
]
