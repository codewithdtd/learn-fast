from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class WritingAIUsage(TimestampMixin, Base):
    __tablename__ = "writing_ai_usage"
    __table_args__ = (
        UniqueConstraint("user_id", "usage_date", name="uq_writing_ai_usage_user_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    usage_date: Mapped[date] = mapped_column(Date, nullable=False)
    used_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    topic_generation_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
