from typing import Any

from sqlalchemy import ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class IELTSPracticeTestSet(TimestampMixin, Base):
    __tablename__ = "ielts_practice_test_sets"
    __table_args__ = (UniqueConstraint("source_id", "idempotency_key", name="uq_ielts_source_idempotency"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("ielts_practice_sources.id", ondelete="CASCADE"), nullable=False, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="generating")
    skills: Mapped[str] = mapped_column(String(16), nullable=False)
    count_per_skill: Mapped[int] = mapped_column(Integer, nullable=False)
    questions_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    error_code: Mapped[str | None] = mapped_column(String(40))
