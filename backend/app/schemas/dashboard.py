from datetime import datetime

from pydantic import BaseModel

from app.models.enums import SheetPriority, SheetStatus, StudyDirection, StudySessionType


class DashboardSheetItem(BaseModel):
    id: int
    name: str
    position: int
    card_count: int
    status: SheetStatus
    priority: SheetPriority
    next_review_at: datetime | None
    workbook_id: int
    workbook_name: str


class DashboardActiveSessionItem(BaseModel):
    id: int
    sheet: DashboardSheetItem
    session_type: StudySessionType
    direction: StudyDirection
    started_at: datetime
    total_cards: int


class DashboardRecentSessionItem(BaseModel):
    id: int
    sheet_id: int
    sheet_name: str
    workbook_id: int
    workbook_name: str
    session_type: StudySessionType
    completed_at: datetime
    total_cards: int
    total_attempts: int
    mastery_score: float | None


class DashboardSummary(BaseModel):
    generated_at: datetime
    due_sheets: list[DashboardSheetItem]
    active_sessions: list[DashboardActiveSessionItem]
    new_sheets: list[DashboardSheetItem]
    weak_card_count: int
    recent_sessions: list[DashboardRecentSessionItem]
