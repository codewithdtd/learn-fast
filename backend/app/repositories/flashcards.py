from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.flashcard import Flashcard


def get_flashcard(db: Session, card_id: int) -> Flashcard | None:
    return db.scalar(select(Flashcard).where(Flashcard.id == card_id))
