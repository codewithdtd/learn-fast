import logging

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.flashcard import Flashcard
from app.repositories.flashcards import get_flashcard


logger = logging.getLogger(__name__)


class FlashcardPersistenceError(RuntimeError):
    """Raised when an edited phrase and meaning cannot be committed together."""


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
