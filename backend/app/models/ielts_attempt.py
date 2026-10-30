from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class IELTSPracticeAttempt(TimestampMixin, Base):
    __tablename__ = "ielts_practice_attempts"
    __table_args__ = (CheckConstraint("(user_id IS NOT NULL AND guest_key_hash IS NULL) OR (user_id IS NULL AND guest_key_hash IS NOT NULL)", name="ck_ielts_attempt_owner"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    test_set_id: Mapped[int] = mapped_column(ForeignKey("ielts_practice_test_sets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    guest_key_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    skill: Mapped[str] = mapped_column(String(12), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="draft")
    answers_json: Mapped[dict[str, str]] = mapped_column(JSON, nullable=False, default=dict)
    score: Mapped[int | None] = mapped_column(Integer)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
