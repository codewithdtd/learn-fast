import logging

from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_admin, get_current_user_optional
from app.core.database import get_db
from app.models import Flashcard, SheetStatus, StudySheet, User, Workbook
from app.schemas.flashcard import FlashcardListItem
from app.schemas.sheet import SheetDetail, SheetUpdate
from app.schemas.workbook import SheetSummary
from app.services.public_preview import get_guest_preview_workbook
from app.services.srs import SrsPersistenceError, list_due_sheets


logger = logging.getLogger(__name__)
router = APIRouter(tags=["sheets"])


def get_sheet_or_404(db: Session, sheet_id: int) -> StudySheet:
    sheet = db.scalar(
        select(StudySheet)
        .where(StudySheet.id == sheet_id)
        .options(selectinload(StudySheet.workbook))
    )
    if sheet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study sheet not found.")
    return sheet


def ensure_sheet_visible(db: Session, sheet: StudySheet, current_user: User | None) -> None:
    # Owners may study their private workbook; other non-admins receive only the read-only showcase workbook.
    if current_user is not None and current_user.is_superuser:
        return
    if current_user is not None and sheet.workbook.user_id == current_user.id:
        return
    preview = get_guest_preview_workbook(db)
    if preview is None or sheet.workbook_id != preview.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study sheet not found.")


@router.get("/sheets/due", response_model=list[SheetSummary])
def list_due_sheets_api(db: Session = Depends(get_db), current_user: User | None = Depends(get_current_user_optional)) -> list[SheetSummary]:
    if current_user is None or not current_user.is_superuser:
        preview = get_guest_preview_workbook(db)
        if preview is None and current_user is None:
            return []
        now = datetime.now(timezone.utc)
        statement = select(StudySheet).join(Workbook)
        if current_user is None:
            statement = statement.where(StudySheet.workbook_id == preview.id)
        elif preview is not None:
            statement = statement.where(or_(Workbook.user_id == current_user.id, StudySheet.workbook_id == preview.id))
        else:
            statement = statement.where(Workbook.user_id == current_user.id)
        sheets = db.scalars(statement.where(
            StudySheet.next_review_at.is_not(None), StudySheet.next_review_at <= now
        ).order_by(StudySheet.next_review_at, StudySheet.position)).all()
        return [SheetSummary.model_validate(sheet) for sheet in sheets]
    try:
        return [SheetSummary.model_validate(sheet) for sheet in list_due_sheets(db)]
    except SrsPersistenceError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Due sheets could not be synchronized. Please try again.",
        ) from error


@router.get("/sheets/not-started", response_model=list[SheetSummary])
def list_not_started_sheets(db: Session = Depends(get_db), current_user: User | None = Depends(get_current_user_optional)) -> list[SheetSummary]:
    statement = select(StudySheet).join(Workbook).where(StudySheet.status == SheetStatus.NOT_STARTED)
    if current_user is None or not current_user.is_superuser:
        preview = get_guest_preview_workbook(db)
        if current_user is None and preview is None:
            return []
        if current_user is None:
            statement = statement.where(StudySheet.workbook_id == preview.id)
        elif preview is not None:
            statement = statement.where(or_(Workbook.user_id == current_user.id, StudySheet.workbook_id == preview.id))
        else:
            statement = statement.where(Workbook.user_id == current_user.id)
    sheets = db.scalars(
        statement
        .order_by(StudySheet.workbook_id, StudySheet.position)
    ).all()
    return [SheetSummary.model_validate(sheet) for sheet in sheets]


@router.get("/sheets/{sheet_id}", response_model=SheetDetail)
def get_sheet(sheet_id: int, db: Session = Depends(get_db), current_user: User | None = Depends(get_current_user_optional)) -> SheetDetail:
    sheet = get_sheet_or_404(db, sheet_id)
    ensure_sheet_visible(db, sheet, current_user)
    return SheetDetail.model_validate(sheet)


@router.get("/sheets/{sheet_id}/cards", response_model=list[FlashcardListItem])
def list_sheet_cards(sheet_id: int, db: Session = Depends(get_db), current_user: User | None = Depends(get_current_user_optional)) -> list[FlashcardListItem]:
    ensure_sheet_visible(db, get_sheet_or_404(db, sheet_id), current_user)
    cards = db.scalars(
        select(Flashcard).where(Flashcard.sheet_id == sheet_id).order_by(Flashcard.position)
    ).all()
    return [FlashcardListItem.model_validate(card) for card in cards]


@router.patch("/sheets/{sheet_id}", response_model=SheetDetail)
def update_sheet(
    sheet_id: int,
    update: SheetUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin),
) -> SheetDetail:
    sheet = get_sheet_or_404(db, sheet_id)
    # The endpoint remains a partial update so existing priority controls keep
    # working while name editing can reuse the same resource URL.
    if update.name is not None:
        sheet.name = update.name
    if update.priority is not None:
        sheet.priority = update.priority
    try:
        db.commit()
        db.refresh(sheet, attribute_names=["workbook"])
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Study sheet update failed after database rollback.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Study sheet could not be updated. Please try again.",
        ) from error

    return SheetDetail.model_validate(sheet)
