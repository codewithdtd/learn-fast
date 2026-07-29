from enum import Enum


class SheetStatus(str, Enum):
    NOT_STARTED = "not_started"
    LEARNING = "learning"
    LEARNED = "learned"
    DUE = "due"


class SheetPriority(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
