from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, utc_now

if TYPE_CHECKING:
    from app.models.study_sheet import StudySheet


class Workbook(TimestampMixin, Base):
    __tablename__ = "workbooks"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    sheet_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    total_cards: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # A workbook owns its imported sheets; removing it must not leave orphaned
    # content that can no longer be reached by the learning workflow.
    sheets: Mapped[list["StudySheet"]] = relationship(
        back_populates="workbook",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="StudySheet.position",
    )
