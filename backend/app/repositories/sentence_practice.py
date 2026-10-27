from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.flashcard import Flashcard
from app.models.study_sheet import StudySheet
from sqlalchemy.orm import selectinload


def get_sentence_card(db: Session, flashcard_id: int) -> Flashcard | None:
    # Thư viện workbook là nội dung học dùng chung; router bắt buộc admin trước khi đọc nguồn.
    # Bài làm tạo từ nguồn này vẫn thuộc riêng user_id và dùng repository Writing có owner scope.
    return db.scalar(select(Flashcard).where(Flashcard.id == flashcard_id))


def get_practice_sheet(db: Session, sheet_id: int) -> StudySheet | None:
    return db.scalar(select(StudySheet).where(StudySheet.id == sheet_id).options(selectinload(StudySheet.workbook)))


def get_sheet_practice_cards(db: Session, sheet_id: int, card_ids: list[int]) -> list[Flashcard]:
    return list(db.scalars(select(Flashcard).where(Flashcard.sheet_id == sheet_id, Flashcard.id.in_(card_ids))).all())
