from typing import Any

from sqlalchemy import CheckConstraint, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class IELTSPracticeSource(TimestampMixin, Base):
    __tablename__ = "ielts_practice_sources"
    __table_args__ = (CheckConstraint("(user_id IS NOT NULL AND guest_key_hash IS NULL) OR (user_id IS NULL AND guest_key_hash IS NOT NULL)", name="ck_ielts_source_owner"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    guest_key_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    source_type: Mapped[str] = mapped_column(String(10), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # Chỉ lưu đoạn được chọn; video và transcript đầy đủ vẫn thuộc provider bên ngoài.
    source_text: Mapped[str] = mapped_column(Text, nullable=False)
    segments_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    video_id: Mapped[str | None] = mapped_column(String(11))
    start_seconds: Mapped[float | None] = mapped_column(Float)
    end_seconds: Mapped[float | None] = mapped_column(Float)
    reading_opened: Mapped[bool] = mapped_column(default=False, nullable=False)
