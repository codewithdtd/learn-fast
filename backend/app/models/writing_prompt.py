from typing import Any

from sqlalchemy import Boolean, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class WritingPrompt(TimestampMixin, Base):
    __tablename__ = "writing_prompts"
    __table_args__ = (UniqueConstraint("slug", name="uq_writing_prompts_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), nullable=False)
    title_vi: Mapped[str] = mapped_column(String(160), nullable=False)
    title_en: Mapped[str] = mapped_column(String(160), nullable=False)
    prompt_vi: Mapped[str] = mapped_column(Text, nullable=False)
    prompt_en: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[str] = mapped_column(String(24), default="basic", nullable=False)
    format: Mapped[str] = mapped_column(String(32), default="paragraph", nullable=False)
    target_word_count: Mapped[int] = mapped_column(Integer, default=90, nullable=False)
    sentence_hints: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    paragraph_hints: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    content_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
