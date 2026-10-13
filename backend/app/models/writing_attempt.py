from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, Float
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class WritingAttempt(TimestampMixin, Base):
    __tablename__ = "writing_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    prompt_id: Mapped[int] = mapped_column(
        ForeignKey("writing_prompts.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    prompt_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    revision_of_id: Mapped[int | None] = mapped_column(
        ForeignKey("writing_attempts.id", ondelete="SET NULL"), nullable=True
    )
    draft_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    submitted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    word_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="draft", nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    grading_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    grading_token: Mapped[str | None] = mapped_column(String(36), nullable=True)
    graded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    feedback_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    practice_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    rubric_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
