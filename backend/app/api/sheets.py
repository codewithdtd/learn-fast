import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.models import Flashcard, SheetStatus, StudySheet
from app.schemas.flashcard import FlashcardListItem
from app.schemas.sheet import SheetDetail, SheetUpdate
from app.schemas.workbook import SheetSummary
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


@router.get("/sheets/due", response_model=list[SheetSummary])
def list_due_sheets_api(db: Session = Depends(get_db)) -> list[SheetSummary]:
    try:
        return [SheetSummary.model_validate(sheet) for sheet in list_due_sheets(db)]
    except SrsPersistenceError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Due sheets could not be synchronized. Please try again.",
        ) from error


@router.get("/sheets/not-started", response_model=list[SheetSummary])
def list_not_started_sheets(db: Session = Depends(get_db)) -> list[SheetSummary]:
    sheets = db.scalars(
        select(StudySheet)
        .where(StudySheet.status == SheetStatus.NOT_STARTED)
        .order_by(StudySheet.workbook_id, StudySheet.position)
    ).all()
    return [SheetSummary.model_validate(sheet) for sheet in sheets]


@router.get("/sheets/{sheet_id}", response_model=SheetDetail)
def get_sheet(sheet_id: int, db: Session = Depends(get_db)) -> SheetDetail:
    return SheetDetail.model_validate(get_sheet_or_404(db, sheet_id))


@router.get("/sheets/{sheet_id}/cards", response_model=list[FlashcardListItem])
def list_sheet_cards(sheet_id: int, db: Session = Depends(get_db)) -> list[FlashcardListItem]:
    get_sheet_or_404(db, sheet_id)
    cards = db.scalars(
        select(Flashcard).where(Flashcard.sheet_id == sheet_id).order_by(Flashcard.position)
    ).all()
    return [FlashcardListItem.model_validate(card) for card in cards]


@router.patch("/sheets/{sheet_id}", response_model=SheetDetail)
def update_sheet(
    sheet_id: int,
    update: SheetUpdate,
    db: Session = Depends(get_db),
) -> SheetDetail:
    sheet = get_sheet_or_404(db, sheet_id)
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
