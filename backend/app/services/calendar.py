import calendar
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
import logging

from sqlalchemy import cast, Date, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.models import SheetStatus, StudySession, StudySessionStatus, StudySheet
from app.schemas.calendar import (
    CalendarDayDetail,
    CalendarDayDueSheetItem,
    CalendarDaySessionItem,
    CalendarDaySummary,
    CalendarMonthSummary,
)
from app.services.srs import list_due_sheets


logger = logging.getLogger(__name__)


class CalendarPersistenceError(RuntimeError):
    """Bắn ra khi việc truy vấn dữ liệu lịch hoặc tính streak gặp lỗi."""


def calculate_user_streaks(db: Session, target_date: date) -> tuple[int, int]:
    """
    Tính toán streak hiện tại (current_streak) và streak dài nhất (longest_streak).
    
    Quy tắc tính streak:
    - Một ngày được tính là đã học nếu có ít nhất 1 session ở trạng thái COMPLETED trong ngày đó.
    - Streak hiện tại không bị đứt nếu hôm nay chưa học nhưng hôm qua đã học (cho phép hoàn thành bài trong ngày hôm nay).
    - Longest streak là chuỗi ngày liên tục dài nhất trong toàn bộ lịch sử học tập.
    """
    # Lấy danh sách completed_at của các session hoàn thành
    sessions_completed = db.scalars(
        select(StudySession.completed_at)
        .where(
            StudySession.status == StudySessionStatus.COMPLETED,
            StudySession.completed_at.is_not(None),
        )
        .order_by(StudySession.completed_at.asc())
    ).all()

    if not sessions_completed:
        return 0, 0

    studied_set: set[date] = {dt.date() for dt in sessions_completed if dt is not None}


    # 1. Tính Current Streak
    current_streak = 0
    # Bắt đầu kiểm tra từ hôm nay
    check_date = target_date
    if check_date in studied_set:
        # Nếu hôm nay đã học, đếm lùi từ hôm nay
        while check_date in studied_set:
            current_streak += 1
            check_date -= timedelta(days=1)
    else:
        # Nếu hôm nay chưa học, kiểm tra xem hôm qua có học không
        check_date = target_date - timedelta(days=1)
        while check_date in studied_set:
            current_streak += 1
            check_date -= timedelta(days=1)

    # 2. Tính Longest Streak
    longest_streak = 0
    temp_streak = 0
    sorted_dates = sorted(studied_set)
    if sorted_dates:
        temp_streak = 1
        longest_streak = 1
        for i in range(1, len(sorted_dates)):
            if sorted_dates[i] == sorted_dates[i - 1] + timedelta(days=1):
                temp_streak += 1
            else:
                temp_streak = 1
            if temp_streak > longest_streak:
                longest_streak = temp_streak

    return current_streak, longest_streak


def get_month_calendar_summary(
    db: Session,
    year: int,
    month: int,
    *,
    now: datetime | None = None,
) -> CalendarMonthSummary:
    """
    Lấy dữ liệu tổng hợp theo tháng cho giao diện Check-in Calendar:
    - Danh sách các ngày trong tháng (has_studied, sessions_count, cards_reviewed, due_sheets_count)
    - Thông số Streak (current & longest)
    - Tổng ngày đã học và tổng thẻ đã ôn trong tháng
    """
    current_dt = now or datetime.now(timezone.utc)
    today = current_dt.date()

    try:
        # Đồng bộ trạng thái các sheet due hôm nay
        list_due_sheets(db, now=current_dt)

        # Xác định khoảng thời gian đầu tháng - cuối tháng
        _, num_days = calendar.monthrange(year, month)
        start_date = date(year, month, 1)
        end_date = date(year, month, num_days)

        start_dt = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
        end_dt = datetime.combine(end_date, time.max, tzinfo=timezone.utc)

        # 1. Truy vấn các sessions hoàn thành trong tháng
        sessions_in_month = db.scalars(
            select(StudySession)
            .where(
                StudySession.status == StudySessionStatus.COMPLETED,
                StudySession.completed_at >= start_dt,
                StudySession.completed_at <= end_dt,
            )
        ).all()

        # Nhóm theo ngày (date)
        sessions_by_date: dict[date, list[StudySession]] = defaultdict(list)
        for s in sessions_in_month:
            if s.completed_at:
                s_date = s.completed_at.date()
                sessions_by_date[s_date].append(s)

        # 2. Truy vấn các sheets có lịch ôn tập (next_review_at) trong tháng
        due_sheets_in_month = db.scalars(
            select(StudySheet).where(
                StudySheet.next_review_at >= start_dt,
                StudySheet.next_review_at <= end_dt,
            )
        ).all()

        due_sheets_by_date: dict[date, list[StudySheet]] = defaultdict(list)
        for sheet in due_sheets_in_month:
            if sheet.next_review_at:
                sh_date = sheet.next_review_at.date()
                due_sheets_by_date[sh_date].append(sheet)

        # 3. Tính streaks
        current_streak, longest_streak = calculate_user_streaks(db, today)

        # 4. Xây dựng dữ liệu từng ngày trong tháng
        days_summary: list[CalendarDaySummary] = []
        total_cards_this_month = 0
        study_days_set = set()

        for day_num in range(1, num_days + 1):
            d = date(year, month, day_num)
            day_sessions = sessions_by_date.get(d, [])
            day_due = due_sheets_by_date.get(d, [])

            cards_count = sum(s.total_cards for s in day_sessions)
            has_studied = len(day_sessions) > 0

            if has_studied:
                study_days_set.add(d)
                total_cards_this_month += cards_count

            days_summary.append(
                CalendarDaySummary(
                    date=d,
                    is_today=(d == today),
                    is_future=(d > today),
                    has_studied=has_studied,
                    sessions_count=len(day_sessions),
                    cards_reviewed=cards_count,
                    due_sheets_count=len(day_due),
                )
            )

        # Kiểm tra trạng thái hôm nay
        today_sessions = sessions_by_date.get(today, []) if year == today.year and month == today.month else []
        today_due = due_sheets_by_date.get(today, []) if year == today.year and month == today.month else []

        return CalendarMonthSummary(
            year=year,
            month=month,
            current_streak=current_streak,
            longest_streak=longest_streak,
            total_study_days_this_month=len(study_days_set),
            total_cards_this_month=total_cards_this_month,
            today_has_studied=len(today_sessions) > 0,
            today_due_count=len(today_due),
            days=days_summary,
        )

    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Failed to build calendar month summary.")
        raise CalendarPersistenceError("Could not retrieve calendar data.") from error


def get_calendar_day_detail(
    db: Session,
    target_date: date,
    *,
    now: datetime | None = None,
) -> CalendarDayDetail:
    """
    Lấy thông tin chi tiết các buổi học và các sheet đến hạn ôn của 1 ngày cụ thể.
    """
    current_dt = now or datetime.now(timezone.utc)
    today = current_dt.date()

    start_dt = datetime.combine(target_date, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(target_date, time.max, tzinfo=timezone.utc)

    try:
        # Lấy completed sessions trong ngày
        sessions = db.scalars(
            select(StudySession)
            .where(
                StudySession.status == StudySessionStatus.COMPLETED,
                StudySession.completed_at >= start_dt,
                StudySession.completed_at <= end_dt,
            )
            .options(selectinload(StudySession.sheet).selectinload(StudySheet.workbook))
            .order_by(StudySession.completed_at.desc())
        ).all()

        # Lấy due sheets trong ngày
        due_sheets = db.scalars(
            select(StudySheet)
            .where(
                StudySheet.next_review_at >= start_dt,
                StudySheet.next_review_at <= end_dt,
            )
            .options(selectinload(StudySheet.workbook))
            .order_by(StudySheet.priority.desc(), StudySheet.id.asc())
        ).all()

        session_items = [
            CalendarDaySessionItem(
                id=s.id,
                sheet_id=s.sheet.id,
                sheet_name=s.sheet.name,
                workbook_name=s.sheet.workbook.name,
                session_type=s.session_type,
                completed_at=s.completed_at,  # type: ignore[arg-type]
                total_cards=s.total_cards,
                total_attempts=s.total_attempts,
                mastery_score=s.mastery_score,
            )
            for s in sessions
            if s.completed_at
        ]

        due_items = [
            CalendarDayDueSheetItem(
                id=sh.id,
                name=sh.name,
                workbook_id=sh.workbook_id,
                workbook_name=sh.workbook.name,
                card_count=sh.card_count,
                priority=sh.priority,
                status=sh.status,
                next_review_at=sh.next_review_at,
            )
            for sh in due_sheets
        ]

        total_cards = sum(s.total_cards for s in sessions)

        return CalendarDayDetail(
            date=target_date,
            is_today=(target_date == today),
            has_studied=len(sessions) > 0,
            total_cards_reviewed=total_cards,
            completed_sessions=session_items,
            due_sheets=due_items,
        )

    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Failed to load calendar day details.")
        raise CalendarPersistenceError(f"Could not load details for date {target_date}.") from error
