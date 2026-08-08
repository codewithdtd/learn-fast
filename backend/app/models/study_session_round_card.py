from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import StudyRoundCardResult, enum_values
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.study_session_card import StudySessionCard
    from app.models.study_session_round import StudySessionRound


class StudySessionRoundCard(TimestampMixin, Base):
    __tablename__ = "study_session_round_cards"
    __table_args__ = (
        UniqueConstraint("round_id", "session_card_id", name="uq_round_cards_round_session_card"),
        UniqueConstraint("round_id", "position", name="uq_round_cards_round_position"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    round_id: Mapped[int] = mapped_column(
        ForeignKey("study_session_rounds.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_card_id: Mapped[int] = mapped_column(
        ForeignKey("study_session_cards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    result: Mapped[StudyRoundCardResult | None] = mapped_column(
        SqlEnum(StudyRoundCardResult, name="study_round_card_result", values_callable=enum_values, native_enum=False, create_constraint=True),
        nullable=True,
    )
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    round: Mapped["StudySessionRound"] = relationship(back_populates="round_cards")
    session_card: Mapped["StudySessionCard"] = relationship()
