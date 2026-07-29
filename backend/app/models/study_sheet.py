from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SqlEnum
from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import SheetPriority, SheetStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.flashcard import Flashcard
    from app.models.workbook import Workbook


def enum_values(enum_class: type[SheetStatus] | type[SheetPriority]) -> list[str]:
    """Persist enum values, not member names, to keep API and DB values aligned."""
    return [member.value for member in enum_class]


class StudySheet(TimestampMixin, Base):
    __tablename__ = "study_sheets"
    __table_args__ = (
        UniqueConstraint("workbook_id", "position", name="uq_study_sheets_workbook_position"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    workbook_id: Mapped[int] = mapped_column(
        ForeignKey("workbooks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    card_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    status: Mapped[SheetStatus] = mapped_column(
        SqlEnum(
            SheetStatus,
            name="sheet_status",
            values_callable=enum_values,
            native_enum=False,
            create_constraint=True,
        ),
        default=SheetStatus.NOT_STARTED,
        server_default=SheetStatus.NOT_STARTED.value,
        nullable=False,
    )
    priority: Mapped[SheetPriority] = mapped_column(
        SqlEnum(
            SheetPriority,
            name="sheet_priority",
            values_callable=enum_values,
            native_enum=False,
            create_constraint=True,
        ),
        default=SheetPriority.MEDIUM,
        server_default=SheetPriority.MEDIUM.value,
        nullable=False,
    )
    first_learned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_review_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    srs_level: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    interval_days: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    review_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    lapse_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    workbook: Mapped["Workbook"] = relationship(back_populates="sheets")
    flashcards: Mapped[list["Flashcard"]] = relationship(
        back_populates="sheet",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Flashcard.position",
    )
