import logging

from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_admin, get_current_user
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.models import Flashcard, StudySheet, User
from app.schemas.flashcard import (
    FlashcardCreate,
    FlashcardBookmarkUpdate,
    FlashcardContentUpdate,
    FlashcardListItem,
    FlashcardWeakUpdate,
)
from app.services.flashcards import (
    FlashcardDuplicateError,
    FlashcardPersistenceError,
    StudySheetNotFoundError,
    create_flashcard as create_flashcard_service,
    delete_flashcard as delete_flashcard_service,
    update_flashcard_content as update_flashcard_content_service,
)


logger = logging.getLogger(__name__)
router = APIRouter(tags=["flashcards"])


@router.post("/sheets/{sheet_id}/cards", response_model=FlashcardListItem, status_code=status.HTTP_201_CREATED)
def create_flashcard(
    sheet_id: int,
    payload: FlashcardCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin),
) -> FlashcardListItem:
    try:
        card = create_flashcard_service(
            db,
            sheet_id,
            payload.phrase,
            payload.meaning,
            payload.example_en,
            payload.example_vi,
        )
    except StudySheetNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except FlashcardDuplicateError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except FlashcardPersistenceError as error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error
    return FlashcardListItem.model_validate(card)


def get_flashcard_or_404(db: Session, card_id: int) -> Flashcard:
    flashcard = db.scalar(
        select(Flashcard)
        .where(Flashcard.id == card_id)
        .options(selectinload(Flashcard.sheet).selectinload(StudySheet.workbook))
    )
    if flashcard is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard not found.",
        )
    return flashcard


def ensure_flashcard_mutable(flashcard: Flashcard, current_user: User) -> None:
    # Chủ sở hữu được sửa thẻ trong workbook riêng; sheet dùng chung vẫn do admin quản lý.
    if current_user.is_superuser or flashcard.sheet.workbook.user_id == current_user.id:
        return
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard not found.")


def persist_flashcard_flag(db: Session, flashcard: Flashcard) -> FlashcardListItem:
    """Commit a flag change atomically and keep database errors out of the API response."""
    try:
        db.commit()
        db.refresh(flashcard)
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Flashcard flag update failed after database rollback.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Flashcard could not be updated. Please try again.",
        ) from error

    return FlashcardListItem.model_validate(flashcard)


@router.patch("/flashcards/{card_id}", response_model=FlashcardListItem)
def update_flashcard_content(
    card_id: int,
    update: FlashcardContentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FlashcardListItem:
    ensure_flashcard_mutable(get_flashcard_or_404(db, card_id), current_user)
    try:
        flashcard = update_flashcard_content_service(db, card_id, update.phrase, update.meaning)
    except FlashcardPersistenceError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Flashcard could not be updated. Please try again.",
        ) from error
    if flashcard is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard not found.")
    return FlashcardListItem.model_validate(flashcard)


@router.delete("/flashcards/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_flashcard(
    card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    flashcard = get_flashcard_or_404(db, card_id)
    ensure_flashcard_mutable(flashcard, current_user)
    try:
        delete_flashcard_service(db, flashcard)
    except FlashcardPersistenceError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Flashcard could not be deleted. Please try again.",
        ) from error


@router.patch("/flashcards/{card_id}/weak", response_model=FlashcardListItem)
def update_flashcard_weak(
    card_id: int,
    update: FlashcardWeakUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FlashcardListItem:
    flashcard = get_flashcard_or_404(db, card_id)
    ensure_flashcard_mutable(flashcard, current_user)
    # An explicit boolean makes retries idempotent: a repeated request leaves
    # the flag at the value selected by the user instead of toggling it again.
    flashcard.is_weak = update.is_weak
    return persist_flashcard_flag(db, flashcard)


@router.patch("/flashcards/{card_id}/bookmark", response_model=FlashcardListItem)
def update_flashcard_bookmark(
    card_id: int,
    update: FlashcardBookmarkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FlashcardListItem:
    flashcard = get_flashcard_or_404(db, card_id)
    ensure_flashcard_mutable(flashcard, current_user)
    # See the weak endpoint: setting a value, rather than toggling, preserves
    # the intended result if the browser retries a request after a network error.
    flashcard.is_bookmarked = update.is_bookmarked
    return persist_flashcard_flag(db, flashcard)
