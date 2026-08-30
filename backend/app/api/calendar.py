from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.calendar import CalendarDayDetail, CalendarMonthSummary
from app.services.calendar import (
    CalendarPersistenceError,
    get_calendar_day_detail,
    get_month_calendar_summary,
)


router = APIRouter(tags=["calendar"])


@router.get("/calendar/month", response_model=CalendarMonthSummary)
def get_month_summary(
    year: int = Query(..., ge=2020, le=2100, description="Year to view"),
    month: int = Query(..., ge=1, le=12, description="Month to view (1-12)"),
    db: Session = Depends(get_db),
) -> CalendarMonthSummary:
    """
    Get monthly check-in and learning progress summary including streaks.
    """
    try:
        return get_month_calendar_summary(db, year=year, month=month)
    except CalendarPersistenceError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not load calendar data.",
        ) from error


@router.get("/calendar/day", response_model=CalendarDayDetail)
def get_day_detail(
    target_date: date = Query(..., alias="date", description="Date to inspect (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
) -> CalendarDayDetail:
    """
    Get detailed learning session records and scheduled reviews for a specific day.
    """
    try:
        return get_calendar_day_detail(db, target_date=target_date)
    except CalendarPersistenceError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not load day details.",
        ) from error

