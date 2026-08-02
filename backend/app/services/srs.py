import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.models import (
    SrsRating,
    SheetStatus,
    StudySession,
    StudySessionCard,
    StudySessionStatus,
    StudySessionType,
    StudySheet,
)


logger = logging.getLogger(__name__)

SRS_INTERVALS = {1: 1, 2: 3, 3: 7, 4: 14, 5: 30, 6: 60, 7: 90}
MAX_SRS_LEVEL = max(SRS_INTERVALS)


@dataclass(frozen=True)
class SrsSchedule:
    level: int
    interval_days: int
    increment_lapse_count: bool = False


class SrsPayloadError(ValueError):
    """Raised when a valid SRS payload violates scheduling rules."""


class SrsConflictError(ValueError):
    """Raised when persisted scheduling state conflicts with a request."""


class SrsPersistenceError(RuntimeError):
    """Raised after a scheduling transaction has been rolled back."""


def calculate_srs_schedule(
    current_level: int,
    current_interval_days: int,
    rating: SrsRating,
) -> SrsSchedule:
    """Return the next sheet-level schedule without reading or writing the database."""

    normalized_level = min(max(current_level, 0), MAX_SRS_LEVEL)
    if rating is SrsRating.FORGOT:
        return SrsSchedule(level=1, interval_days=SRS_INTERVALS[1], increment_lapse_count=True)

    if rating is SrsRating.HARD:
        # A new sheet has no interval to preserve. Bootstrap it to one day so
        # completing a first session always creates a usable review schedule.
        if normalized_level == 0 or current_interval_days <= 0:
            return SrsSchedule(level=1, interval_days=SRS_INTERVALS[1])
        return SrsSchedule(level=normalized_level, interval_days=current_interval_days)

    level_increment = 1 if rating is SrsRating.GOOD else 2
    next_level = min(max(normalized_level, 0) + level_increment, MAX_SRS_LEVEL)
    return SrsSchedule(level=next_level, interval_days=SRS_INTERVALS[next_level])


def get_rated_session_or_404(db: Session, session_id: int) -> StudySession:
    session = db.scalar(
        select(StudySession)
        .where(StudySession.id == session_id)
        .options(
            selectinload(StudySession.session_cards).selectinload(StudySessionCard.flashcard),
            selectinload(StudySession.sheet).selectinload(StudySheet.workbook),
        )
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study session not found.",
        )
    return session


def rate_completed_session(
    db: Session,
    session_id: int,
    rating: SrsRating,
    *,
    rated_at: datetime | None = None,
) -> tuple[StudySession, StudySheet]:
    session = get_rated_session_or_404(db, session_id)
    if session.status is not StudySessionStatus.COMPLETED:
        raise SrsConflictError("Only a completed study session can be rated.")
    if session.session_type not in {
        StudySessionType.NEW_LEARNING,
        StudySessionType.SRS_REVIEW,
    }:
        raise SrsPayloadError("This practice session does not update the sheet review schedule.")

    if session.sheet_rating is not None:
        if session.sheet_rating == rating.value:
            return session, session.sheet
        raise SrsConflictError("This study session already has a different SRS rating.")

    schedule = calculate_srs_schedule(
        session.sheet.srs_level,
        session.sheet.interval_days,
        rating,
    )
    now = rated_at or datetime.now(timezone.utc)
    sheet = session.sheet
    session.sheet_rating = rating.value
    sheet.status = SheetStatus.LEARNED
    sheet.first_learned_at = sheet.first_learned_at or now
    sheet.last_reviewed_at = now
    sheet.next_review_at = now + timedelta(days=schedule.interval_days)
    sheet.srs_level = schedule.level
    sheet.interval_days = schedule.interval_days
    sheet.review_count += 1
    if schedule.increment_lapse_count:
        sheet.lapse_count += 1

    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("SRS rating persistence failed after database rollback.")
        raise SrsPersistenceError("Sheet review schedule could not be saved.") from error

    refreshed_session = get_rated_session_or_404(db, session.id)
    return refreshed_session, refreshed_session.sheet


def list_due_sheets(db: Session, *, now: datetime | None = None) -> list[StudySheet]:
    due_at = now or datetime.now(timezone.utc)
    # Day 12 intentionally has no scheduler/cron. Reading the due queue performs
    # this small, idempotent learned -> due transition without changing SRS dates
    # or counters, so the persisted status still reflects what users can study now.
    sheets_to_mark_due = db.scalars(
        select(StudySheet).where(
            StudySheet.next_review_at.is_not(None),
            StudySheet.next_review_at <= due_at,
            StudySheet.status == SheetStatus.LEARNED,
        )
    ).all()
    for sheet in sheets_to_mark_due:
        sheet.status = SheetStatus.DUE

    if sheets_to_mark_due:
        try:
            db.commit()
        except SQLAlchemyError as error:
            db.rollback()
            logger.exception("Due sheet status synchronization failed after database rollback.")
            raise SrsPersistenceError("Due sheets could not be synchronized.") from error

    return db.scalars(
        select(StudySheet)
        .where(
            StudySheet.next_review_at.is_not(None),
            StudySheet.next_review_at <= due_at,
        )
        .options(selectinload(StudySheet.workbook))
        .order_by(StudySheet.next_review_at, StudySheet.priority, StudySheet.workbook_id, StudySheet.position)
    ).all()
