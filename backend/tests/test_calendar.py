from datetime import date, datetime, timedelta, timezone
import pytest
from sqlalchemy.orm import Session

from app.models import (
    Flashcard,
    SheetPriority,
    SheetStatus,
    StudyDirection,
    StudySession,
    StudySessionStatus,
    StudySessionType,
    StudySheet,
    Workbook,
)
from app.services.calendar import calculate_user_streaks, get_calendar_day_detail, get_month_calendar_summary


def create_workbook_and_sheet(db: Session, name: str = "Test Sheet") -> tuple[Workbook, StudySheet]:
    workbook = Workbook(name="Test Workbook", original_filename="test.xlsx")
    db.add(workbook)
    db.flush()

    sheet = StudySheet(
        workbook_id=workbook.id,
        name=name,
        position=1,
        card_count=5,
        status=SheetStatus.LEARNING,
        priority=SheetPriority.MEDIUM,
    )
    db.add(sheet)
    db.flush()
    return workbook, sheet


def test_calculate_user_streaks_empty(db_session: Session) -> None:
    today = date(2026, 8, 30)
    current, longest = calculate_user_streaks(db_session, today)
    assert current == 0
    assert longest == 0


def test_calculate_user_streaks_with_sessions(db_session: Session) -> None:
    today = date(2026, 8, 30)
    _, sheet = create_workbook_and_sheet(db_session)

    # Tạo các session hoàn thành vào: 2026-08-28, 2026-08-29, 2026-08-30
    for day_offset in [2, 1, 0]:
        session_dt = datetime(2026, 8, 30 - day_offset, 10, 0, tzinfo=timezone.utc)
        session = StudySession(
            sheet_id=sheet.id,
            session_type=StudySessionType.NEW_LEARNING,
            direction=StudyDirection.EN_TO_VI,
            status=StudySessionStatus.COMPLETED,
            started_at=session_dt - timedelta(minutes=15),
            completed_at=session_dt,
            total_cards=5,
            total_attempts=5,
            mastery_score=100.0,
        )
        db_session.add(session)
    db_session.commit()

    current, longest = calculate_user_streaks(db_session, today)
    assert current == 3
    assert longest == 3


def test_get_month_calendar_summary_and_day_detail(db_session: Session) -> None:
    today_dt = datetime(2026, 8, 30, 12, 0, tzinfo=timezone.utc)
    _, sheet = create_workbook_and_sheet(db_session, name="Vocabulary Sheet")

    # Set due date
    sheet.next_review_at = datetime(2026, 8, 30, 15, 0, tzinfo=timezone.utc)
    
    # Session completed today
    session = StudySession(
        sheet_id=sheet.id,
        session_type=StudySessionType.SRS_REVIEW,
        direction=StudyDirection.EN_TO_VI,
        status=StudySessionStatus.COMPLETED,
        started_at=today_dt - timedelta(minutes=10),
        completed_at=today_dt,
        total_cards=10,
        total_attempts=12,
        mastery_score=90.0,
    )
    db_session.add(session)
    db_session.commit()

    summary = get_month_calendar_summary(db_session, year=2026, month=8, now=today_dt)
    assert summary.year == 2026
    assert summary.month == 8
    assert summary.current_streak == 1
    assert summary.today_has_studied is True
    assert summary.total_study_days_this_month == 1
    assert summary.total_cards_this_month == 10

    # Test day detail
    day_detail = get_calendar_day_detail(db_session, date(2026, 8, 30), now=today_dt)
    assert day_detail.has_studied is True
    assert len(day_detail.completed_sessions) == 1
    assert day_detail.completed_sessions[0].sheet_name == "Vocabulary Sheet"
