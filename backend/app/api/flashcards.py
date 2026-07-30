import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Flashcard
from app.schemas.flashcard import (
    FlashcardBookmarkUpdate,
    FlashcardListItem,
    FlashcardWeakUpdate,
)


logger = logging.getLogger(__name__)
router = APIRouter(tags=["flashcards"])


def get_flashcard_or_404(db: Session, card_id: int) -> Flashcard:
    flashcard = db.scalar(select(Flashcard).where(Flashcard.id == card_id))
    if flashcard is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard not found.",
        )
    return flashcard


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


@router.patch("/flashcards/{card_id}/weak", response_model=FlashcardListItem)
def update_flashcard_weak(
    card_id: int,
    update: FlashcardWeakUpdate,
    db: Session = Depends(get_db),
) -> FlashcardListItem:
    flashcard = get_flashcard_or_404(db, card_id)
    # An explicit boolean makes retries idempotent: a repeated request leaves
    # the flag at the value selected by the user instead of toggling it again.
    flashcard.is_weak = update.is_weak
    return persist_flashcard_flag(db, flashcard)


@router.patch("/flashcards/{card_id}/bookmark", response_model=FlashcardListItem)
def update_flashcard_bookmark(
    card_id: int,
    update: FlashcardBookmarkUpdate,
    db: Session = Depends(get_db),
) -> FlashcardListItem:
    flashcard = get_flashcard_or_404(db, card_id)
    # See the weak endpoint: setting a value, rather than toggling, preserves
    # the intended result if the browser retries a request after a network error.
    flashcard.is_bookmarked = update.is_bookmarked
    return persist_flashcard_flag(db, flashcard)
