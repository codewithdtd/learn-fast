from datetime import date, datetime
from pydantic import BaseModel, ConfigDict

from app.models.enums import SheetPriority, SheetStatus, StudySessionType


class CalendarDaySessionItem(BaseModel):
    """Chi tiết tóm tắt 1 session đã hoàn thành trong ngày."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    sheet_id: int
    sheet_name: str
    workbook_name: str
    session_type: StudySessionType
    completed_at: datetime
    total_cards: int
    total_attempts: int
    mastery_score: float | None


class CalendarDayDueSheetItem(BaseModel):
    """Chi tiết tóm tắt 1 sheet đến hạn ôn tập trong ngày."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    workbook_id: int
    workbook_name: str
    card_count: int
    priority: SheetPriority
    status: SheetStatus
    next_review_at: datetime | None


class CalendarDaySummary(BaseModel):
    """Tổng hợp dữ liệu của một ngày trên lịch điểm danh."""
    date: date
    is_today: bool
    is_future: bool
    has_studied: bool  # True nếu có ít nhất 1 session hoàn thành
    sessions_count: int
    cards_reviewed: int
    due_sheets_count: int


class CalendarMonthSummary(BaseModel):
    """Dữ liệu lịch tháng, streak và các thông số điểm danh."""
    year: int
    month: int
    current_streak: int  # Chuỗi ngày học liên tục tính đến hiện tại
    longest_streak: int  # Chuỗi ngày học liên tục dài nhất từng đạt được
    total_study_days_this_month: int
    total_cards_this_month: int
    today_has_studied: bool
    today_due_count: int
    days: list[CalendarDaySummary]


class CalendarDayDetail(BaseModel):
    """Chi tiết đầy đủ của một ngày khi người dùng click xem."""
    date: date
    is_today: bool
    has_studied: bool
    total_cards_reviewed: int
    completed_sessions: list[CalendarDaySessionItem]
    due_sheets: list[CalendarDayDueSheetItem]
