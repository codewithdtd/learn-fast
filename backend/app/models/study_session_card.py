from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import StudyDirection, enum_values
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.flashcard import Flashcard
    from app.models.study_session import StudySession


class StudySessionCard(TimestampMixin, Base):
    __tablename__ = "study_session_cards"
    __table_args__ = (
        UniqueConstraint("session_id", "flashcard_id", name="uq_session_cards_session_flashcard"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("study_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    flashcard_id: Mapped[int] = mapped_column(
        ForeignKey("flashcards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Mixed sessions get a direction when their first answer arrives, because
    # Day 09 has no UI queue yet to choose a deterministic mixed direction.
    direction: Mapped[StudyDirection | None] = mapped_column(
        SqlEnum(
            StudyDirection,
            name="study_direction",
            values_callable=enum_values,
            native_enum=False,
            create_constraint=True,
        ),
        nullable=True,
    )
    attempt_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    again_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    remembered: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0", nullable=False
    )
    first_try_correct: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0", nullable=False
    )
    last_answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session: Mapped["StudySession"] = relationship(back_populates="session_cards")
    flashcard: Mapped["Flashcard"] = relationship(back_populates="study_session_cards")
