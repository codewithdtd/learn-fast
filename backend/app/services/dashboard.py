import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.models import Flashcard, SheetStatus, StudySession, StudySessionStatus, StudySheet
from app.schemas.dashboard import (
    DashboardActiveSessionItem,
    DashboardRecentSessionItem,
    DashboardSheetItem,
    DashboardSummary,
)
from app.services.srs import SrsPersistenceError, list_due_sheets
from app.services.public_preview import get_guest_preview_workbook


logger = logging.getLogger(__name__)


class DashboardPersistenceError(RuntimeError):
    """Raised when the dashboard snapshot cannot be read consistently."""


def get_public_preview_dashboard(db: Session, *, now: datetime | None = None) -> DashboardSummary:
    """Build a read-only dashboard from one showcase workbook without exposing anyone's session history."""
    generated_at = now or datetime.now(timezone.utc)
    workbook = get_guest_preview_workbook(db)
    if workbook is None:
        sheets: list[DashboardSheetItem] = []
        weak_count = 0
    else:
        sheets = [dashboard_sheet_item(sheet) for sheet in workbook.sheets]
        weak_count = int(db.scalar(
            select(func.count(Flashcard.id))
            .join(StudySheet, Flashcard.sheet_id == StudySheet.id)
            .where(StudySheet.workbook_id == workbook.id, Flashcard.is_weak.is_(True))
        ) or 0)
    # Guest dashboard data is a content showcase; session and account metrics stay private and no SRS synchronization runs.
    return DashboardSummary(
        generated_at=generated_at,
        due_sheets=[],
        active_sessions=[],
        new_sheets=sheets,
        weak_card_count=weak_count,
        recent_sessions=[],
    )


def get_member_dashboard(db: Session, user_id: int, *, now: datetime | None = None) -> DashboardSummary:
    """Show the preview library plus only the signed-in learner's own session history."""
    generated_at = now or datetime.now(timezone.utc)
    base = get_public_preview_dashboard(db, now=generated_at)
    workbook = get_guest_preview_workbook(db)
    if workbook is None:
        return base

    sheet_ids = [sheet.id for sheet in workbook.sheets]
    if not sheet_ids:
        return base
    active_sessions = db.scalars(
        select(StudySession)
        .where(
            StudySession.user_id == user_id,
            StudySession.status == StudySessionStatus.ACTIVE,
            StudySession.sheet_id.in_(sheet_ids),
        )
        .options(selectinload(StudySession.sheet).selectinload(StudySheet.workbook))
        .order_by(StudySession.started_at.desc(), StudySession.id.desc())
    ).all()
    recent_sessions = db.scalars(
        select(StudySession)
        .where(
            StudySession.user_id == user_id,
            StudySession.status == StudySessionStatus.COMPLETED,
            StudySession.completed_at.is_not(None),
            StudySession.sheet_id.in_(sheet_ids),
        )
        .options(selectinload(StudySession.sheet).selectinload(StudySheet.workbook))
        .order_by(StudySession.completed_at.desc(), StudySession.id.desc())
        .limit(5)
    ).all()
    # Preview reads include no due-status sync; every session metric is constrained to the current account.
    return base.model_copy(update={
        "active_sessions": [
            DashboardActiveSessionItem(
                id=session.id,
                sheet=dashboard_sheet_item(session.sheet),
                session_type=session.session_type,
                direction=session.direction,
                started_at=session.started_at,
                total_cards=session.total_cards,
            )
            for session in active_sessions
        ],
        "recent_sessions": [
            DashboardRecentSessionItem(
                id=session.id,
                sheet_id=session.sheet.id,
                sheet_name=session.sheet.name,
                workbook_id=session.sheet.workbook_id,
                workbook_name=session.sheet.workbook.name,
                session_type=session.session_type,
                completed_at=session.completed_at,
                total_cards=session.total_cards,
                total_attempts=session.total_attempts,
                mastery_score=session.mastery_score,
            )
            for session in recent_sessions
        ],
    })


def dashboard_sheet_item(sheet: StudySheet) -> DashboardSheetItem:
    return DashboardSheetItem(
        id=sheet.id,
        name=sheet.name,
        position=sheet.position,
        card_count=sheet.card_count,
        status=sheet.status,
        priority=sheet.priority,
        next_review_at=sheet.next_review_at,
        workbook_id=sheet.workbook_id,
        workbook_name=sheet.workbook.name,
    )


def get_dashboard_summary(
    db: Session,
    *,
    user_id: int | None = None,
    now: datetime | None = None,
    recent_limit: int = 5,
) -> DashboardSummary:
    generated_at = now or datetime.now(timezone.utc)

    try:
        # Dashboard reads use the same learned -> due synchronization as the
        # due-list endpoint. This intentional read-side effect never changes
        # review dates or counters; it only makes the persisted status useful.
        due_sheets = list_due_sheets(db, now=generated_at)
        active_statement = select(StudySession).where(StudySession.status == StudySessionStatus.ACTIVE)
        if user_id is not None:
            active_statement = active_statement.where(StudySession.user_id == user_id)
        active_sessions = db.scalars(
            active_statement
            .options(selectinload(StudySession.sheet).selectinload(StudySheet.workbook))
            .order_by(StudySession.started_at.desc(), StudySession.id.desc())
        ).all()
        active_sheet_ids = select(StudySession.sheet_id).where(StudySession.status == StudySessionStatus.ACTIVE)
        if user_id is not None:
            active_sheet_ids = active_sheet_ids.where(StudySession.user_id == user_id)
        new_sheets = db.scalars(
            select(StudySheet)
            .where(
                StudySheet.status == SheetStatus.NOT_STARTED,
                StudySheet.id.not_in(
                    active_sheet_ids
                ),
            )
            .options(selectinload(StudySheet.workbook))
            .order_by(StudySheet.workbook_id, StudySheet.position)
        ).all()
        weak_card_count = db.scalar(
            select(func.count(Flashcard.id)).where(Flashcard.is_weak.is_(True))
        )
        recent_statement = select(StudySession).where(
                StudySession.status == StudySessionStatus.COMPLETED,
                StudySession.completed_at.is_not(None),
            )
        if user_id is not None:
            recent_statement = recent_statement.where(StudySession.user_id == user_id)
        recent_sessions = db.scalars(
            recent_statement
            .options(selectinload(StudySession.sheet).selectinload(StudySheet.workbook))
            .order_by(StudySession.completed_at.desc(), StudySession.id.desc())
            .limit(recent_limit)
        ).all()
    except SrsPersistenceError as error:
        raise DashboardPersistenceError("Due sheets could not be synchronized.") from error
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Dashboard snapshot query failed after database rollback.")
        raise DashboardPersistenceError("Dashboard data could not be loaded.") from error

    return DashboardSummary(
        generated_at=generated_at,
        due_sheets=[dashboard_sheet_item(sheet) for sheet in due_sheets],
        active_sessions=[
            DashboardActiveSessionItem(
                id=session.id,
                sheet=dashboard_sheet_item(session.sheet),
                session_type=session.session_type,
                direction=session.direction,
                started_at=session.started_at,
                total_cards=session.total_cards,
            )
            for session in active_sessions
        ],
        new_sheets=[dashboard_sheet_item(sheet) for sheet in new_sheets],
        weak_card_count=int(weak_card_count or 0),
        recent_sessions=[
            DashboardRecentSessionItem(
                id=session.id,
                sheet_id=session.sheet.id,
                sheet_name=session.sheet.name,
                workbook_id=session.sheet.workbook_id,
                workbook_name=session.sheet.workbook.name,
                session_type=session.session_type,
                completed_at=session.completed_at,
                total_cards=session.total_cards,
                total_attempts=session.total_attempts,
                mastery_score=session.mastery_score,
            )
            for session in recent_sessions
        ],
    )
