from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SqlEnum, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import StudyRoundScope, StudyRoundStatus, enum_values
from app.models.mixins import TimestampMixin, utc_now

if TYPE_CHECKING:
    from app.models.study_session import StudySession
    from app.models.study_session_round_card import StudySessionRoundCard


class StudySessionRound(TimestampMixin, Base):
    __tablename__ = "study_session_rounds"
    __table_args__ = (
        UniqueConstraint("session_id", "round_number", name="uq_session_round_number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("study_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_round_id: Mapped[int | None] = mapped_column(
        ForeignKey("study_session_rounds.id", ondelete="SET NULL"), nullable=True, index=True
    )
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    scope: Mapped[StudyRoundScope] = mapped_column(
        SqlEnum(StudyRoundScope, name="study_round_scope", values_callable=enum_values, native_enum=False, create_constraint=True),
        nullable=False,
    )
    status: Mapped[StudyRoundStatus] = mapped_column(
        SqlEnum(StudyRoundStatus, name="study_round_status", values_callable=enum_values, native_enum=False, create_constraint=True),
        default=StudyRoundStatus.ACTIVE,
        server_default=StudyRoundStatus.ACTIVE.value,
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_cards: Mapped[int] = mapped_column(Integer, nullable=False)
    remembered_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    again_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    recall_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)

    session: Mapped["StudySession"] = relationship(back_populates="rounds", foreign_keys=[session_id])
    source_round: Mapped["StudySessionRound | None"] = relationship(remote_side=[id], foreign_keys=[source_round_id])
    round_cards: Mapped[list["StudySessionRoundCard"]] = relationship(
        back_populates="round",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="StudySessionRoundCard.position",
    )
