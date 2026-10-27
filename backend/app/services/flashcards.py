import logging
import re

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.flashcard import Flashcard
from app.repositories.flashcards import (
    add_flashcard,
    delete_flashcard as delete_flashcard_record,
    get_flashcard,
    get_next_card_position,
    get_sheet_for_update,
    list_sheet_phrases,
)
from app.repositories.workbooks import refresh_sheet_card_count, refresh_workbook_counts


logger = logging.getLogger(__name__)


class FlashcardPersistenceError(RuntimeError):
    """Raised when an edited phrase and meaning cannot be committed together."""


class FlashcardDuplicateError(ValueError):
    """A phrase already exists in the target sheet."""


class StudySheetNotFoundError(LookupError):
    """The requested destination sheet does not exist."""


def create_flashcard(
    db: Session,
    sheet_id: int,
    phrase: str,
    meaning: str,
    example_en: str | None,
    example_vi: str | None,
) -> Flashcard:
    sheet = get_sheet_for_update(db, sheet_id)
    if sheet is None:
        raise StudySheetNotFoundError("Study sheet not found.")

    # A normalized duplicate check prevents accidental repeat cards while preserving meaningful punctuation in the saved phrase.
    normalized_phrase = re.sub(r"\s+", " ", phrase).strip().casefold()
    existing_phrases = list_sheet_phrases(db, sheet_id)
    if any(re.sub(r"\s+", " ", item).strip().casefold() == normalized_phrase for item in existing_phrases):
        raise FlashcardDuplicateError("This word already exists in the selected sheet.")

    card = Flashcard(
        sheet_id=sheet.id,
        position=get_next_card_position(db, sheet_id),
        phrase=phrase,
        meaning=meaning,
        example_en=example_en,
        example_vi=example_vi,
        is_weak=False,
        is_bookmarked=False,
        correct_count=0,
        incorrect_count=0,
        last_result=None,
        last_reviewed_at=None,
    )
    try:
        add_flashcard(db, card)
        db.flush()
        refresh_sheet_card_count(db, sheet)
        refresh_workbook_counts(db, sheet.workbook_id)
        db.commit()
        db.refresh(card)
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Flashcard creation failed after database rollback.")
        raise FlashcardPersistenceError("Flashcard could not be created.") from error
    return card


def update_flashcard_content(
    db: Session,
    card_id: int,
    phrase: str,
    meaning: str,
) -> Flashcard | None:
    card = get_flashcard(db, card_id)
    if card is None:
        return None

    try:
        # Phrase và meaning tạo thành một thẻ học; lưu cùng transaction để không lộ trạng thái chỉ sửa được một trường.
        card.phrase = phrase
        card.meaning = meaning
        db.commit()
        db.refresh(card)
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Flashcard content update failed after database rollback.")
        raise FlashcardPersistenceError("Flashcard could not be updated.") from error

    return card


def delete_flashcard(db: Session, card: Flashcard) -> None:
    sheet = card.sheet
    workbook_id = sheet.workbook_id
    try:
        # Removing the card also removes its session-card links through the existing FK cascade; refresh cached counts in the same transaction.
        delete_flashcard_record(db, card)
        db.flush()
        refresh_sheet_card_count(db, sheet)
        refresh_workbook_counts(db, workbook_id)
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Flashcard deletion failed after database rollback.")
        raise FlashcardPersistenceError("Flashcard could not be deleted.") from error
