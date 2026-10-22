from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.flashcard import Flashcard


def get_sentence_card(db: Session, flashcard_id: int) -> Flashcard | None:
    # Thư viện workbook là nội dung học dùng chung; router bắt buộc admin trước khi đọc nguồn.
    # Bài làm tạo từ nguồn này vẫn thuộc riêng user_id và dùng repository Writing có owner scope.
    return db.scalar(select(Flashcard).where(Flashcard.id == flashcard_id))
