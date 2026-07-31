from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.study_sheet import StudySheet
    from app.models.study_session_card import StudySessionCard


class Flashcard(TimestampMixin, Base):
    __tablename__ = "flashcards"
    __table_args__ = (
        UniqueConstraint("sheet_id", "position", name="uq_flashcards_sheet_position"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sheet_id: Mapped[int] = mapped_column(
        ForeignKey("study_sheets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    phrase: Mapped[str] = mapped_column(Text, nullable=False)
    meaning: Mapped[str] = mapped_column(Text, nullable=False)
    example_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    example_vi: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_weak: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0", nullable=False
    )
    is_bookmarked: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0", nullable=False
    )
    correct_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    incorrect_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    last_result: Mapped[str | None] = mapped_column(String(32), nullable=True)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    sheet: Mapped["StudySheet"] = relationship(back_populates="flashcards")
    study_session_cards: Mapped[list["StudySessionCard"]] = relationship(
        back_populates="flashcard",
        passive_deletes=True,
    )
