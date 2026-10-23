from datetime import datetime

from sqlalchemy import DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import utc_now


class GuestAIUsage(Base):
    __tablename__ = "guest_ai_usage"
    __table_args__ = (UniqueConstraint("guest_key_hash", "feature", name="uq_guest_ai_feature"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Chỉ lưu hash định danh guest cùng nhóm AI; không lưu user_id, nội dung hay kết quả.
    guest_key_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    feature: Mapped[str] = mapped_column(String(48), nullable=False)
    used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
