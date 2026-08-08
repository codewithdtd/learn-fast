from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SqlEnum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import (
    StudyDirection,
    StudyRoundStatus,
    StudySessionStatus,
    StudySessionType,
    enum_values,
)
from app.models.mixins import TimestampMixin, utc_now

if TYPE_CHECKING:
    from app.models.study_session_round import StudySessionRound
    from app.models.study_session_card import StudySessionCard
    from app.models.study_sheet import StudySheet


class StudySession(TimestampMixin, Base):
    __tablename__ = "study_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    sheet_id: Mapped[int] = mapped_column(
        ForeignKey("study_sheets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_type: Mapped[StudySessionType] = mapped_column(
        SqlEnum(
            StudySessionType,
            name="study_session_type",
            values_callable=enum_values,
            native_enum=False,
            create_constraint=True,
        ),
        nullable=False,
    )
    direction: Mapped[StudyDirection] = mapped_column(
        SqlEnum(
            StudyDirection,
            name="study_direction",
            values_callable=enum_values,
            native_enum=False,
            create_constraint=True,
        ),
        nullable=False,
    )
    status: Mapped[StudySessionStatus] = mapped_column(
        SqlEnum(
            StudySessionStatus,
            name="study_session_status",
            values_callable=enum_values,
            native_enum=False,
            create_constraint=True,
        ),
        default=StudySessionStatus.ACTIVE,
        server_default=StudySessionStatus.ACTIVE.value,
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_cards: Mapped[int] = mapped_column(Integer, nullable=False)
    total_attempts: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    first_try_correct: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    again_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    mastery_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    sheet_rating: Mapped[str | None] = mapped_column(String(32), nullable=True)

    sheet: Mapped["StudySheet"] = relationship(back_populates="study_sessions")
    session_cards: Mapped[list["StudySessionCard"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="StudySessionCard.id",
    )
    rounds: Mapped[list["StudySessionRound"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="StudySessionRound.round_number",
    )

    @property
    def active_round(self) -> "StudySessionRound | None":
        return next((item for item in self.rounds if item.status is StudyRoundStatus.ACTIVE), None)

    @property
    def round_summaries(self) -> list["StudySessionRound"]:
        return [item for item in self.rounds if item.status is StudyRoundStatus.COMPLETED]
