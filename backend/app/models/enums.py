from enum import Enum


def enum_values(enum_class: type[Enum]) -> list[str]:
    """Persist string enum values rather than Python member names."""
    return [member.value for member in enum_class]


class SheetStatus(str, Enum):
    NOT_STARTED = "not_started"
    LEARNING = "learning"
    LEARNED = "learned"
    DUE = "due"


class SheetPriority(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class StudySessionType(str, Enum):
    NEW_LEARNING = "new_learning"
    SRS_REVIEW = "srs_review"
    WEAK_CARDS = "weak_cards"
    QUICK_RECALL = "quick_recall"


class StudyDirection(str, Enum):
    EN_TO_VI = "en_to_vi"
    VI_TO_EN = "vi_to_en"
    MIXED = "mixed"


class StudySessionStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class StudyRoundScope(str, Enum):
    ALL = "all"
    FORGOTTEN = "forgotten"


class StudyRoundStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"


class StudyRoundCardResult(str, Enum):
    AGAIN = "again"
    REMEMBERED = "remembered"


class SrsRating(str, Enum):
    FORGOT = "forgot"
    HARD = "hard"
    GOOD = "good"
    EASY = "easy"


class NotificationType(str, Enum):
    SRS_DUE = "srs_due"
    DAILY_CHECKIN = "daily_checkin"
    STREAK_MILESTONE = "streak_milestone"
    SYSTEM = "system"
