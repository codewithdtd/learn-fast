from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.core.database import get_db
from app.models import User
from app.schemas.calendar import CalendarDayDetail, CalendarMonthSummary
from app.services.calendar import CalendarPersistenceError, get_calendar_day_detail, get_month_calendar_summary
from app.services.public_preview import get_guest_preview_workbook


router = APIRouter(tags=["calendar"])


@router.get("/calendar/month", response_model=CalendarMonthSummary)
def get_month_summary(
    year: int = Query(..., ge=2020, le=2100, description="Year to view"),
    month: int = Query(..., ge=1, le=12, description="Month to view (1-12)"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> CalendarMonthSummary:
    try:
        is_guest = current_user is None
        preview = get_guest_preview_workbook(db) if is_guest or not current_user.is_superuser else None
        return get_month_calendar_summary(
            db,
            year=year,
            month=month,
            user_id=current_user.id if current_user else None,
            workbook_id=preview.id if preview else (-1 if current_user is None or not current_user.is_superuser else None),
            sync_due=bool(current_user and current_user.is_superuser),
            include_sessions=not is_guest,
        )
    except CalendarPersistenceError as error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not load calendar data.") from error


@router.get("/calendar/day", response_model=CalendarDayDetail)
def get_day_detail(
    target_date: date = Query(..., alias="date", description="Date to inspect (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> CalendarDayDetail:
    try:
        is_guest = current_user is None
        preview = get_guest_preview_workbook(db) if is_guest or not current_user.is_superuser else None
        return get_calendar_day_detail(
            db,
            target_date=target_date,
            user_id=current_user.id if current_user else None,
            workbook_id=preview.id if preview else (-1 if current_user is None or not current_user.is_superuser else None),
            include_sessions=not is_guest,
        )
    except CalendarPersistenceError as error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not load day details.") from error
