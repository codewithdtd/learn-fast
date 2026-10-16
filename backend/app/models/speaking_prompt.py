from typing import Any

from sqlalchemy import Boolean, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class SpeakingPrompt(TimestampMixin, Base):
    __tablename__ = "speaking_prompts"
    __table_args__ = (UniqueConstraint("slug", name="uq_speaking_prompts_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), nullable=False)
    title_en: Mapped[str] = mapped_column(String(160), nullable=False)
    title_vi: Mapped[str] = mapped_column(String(160), nullable=False)
    question_en: Mapped[str] = mapped_column(Text, nullable=False)
    question_vi: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    difficulty: Mapped[str] = mapped_column(String(24), default="basic", nullable=False)
    hints: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
