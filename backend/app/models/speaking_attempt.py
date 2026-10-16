from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class SpeakingAttempt(TimestampMixin, Base):
    __tablename__ = "speaking_attempts"
    __table_args__ = (Index("ix_speaking_attempts_user_created", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    prompt_id: Mapped[int] = mapped_column(ForeignKey("speaking_prompts.id", ondelete="RESTRICT"), nullable=False, index=True)
    prompt_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    transcript: Mapped[str] = mapped_column(Text, default="", nullable=False)
    feedback_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="created", nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    quota_consumed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    processing_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    grading_token: Mapped[str | None] = mapped_column(String(36), nullable=True)
    graded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
