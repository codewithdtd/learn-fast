from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.flashcard import Flashcard
from app.models.study_sheet import StudySheet


def get_flashcard(db: Session, card_id: int) -> Flashcard | None:
    return db.scalar(select(Flashcard).where(Flashcard.id == card_id))


def get_sheet_for_update(db: Session, sheet_id: int) -> StudySheet | None:
    return db.scalar(select(StudySheet).where(StudySheet.id == sheet_id).with_for_update())


def list_sheet_phrases(db: Session, sheet_id: int) -> list[str]:
    return list(db.scalars(select(Flashcard.phrase).where(Flashcard.sheet_id == sheet_id)).all())


def get_next_card_position(db: Session, sheet_id: int) -> int:
    maximum = db.scalar(select(func.max(Flashcard.position)).where(Flashcard.sheet_id == sheet_id))
    return (maximum or 0) + 1


def add_flashcard(db: Session, card: Flashcard) -> None:
    db.add(card)
