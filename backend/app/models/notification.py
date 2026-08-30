from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import NotificationType, enum_values
from app.models.mixins import TimestampMixin, utc_now


class Notification(TimestampMixin, Base):
    """
    Model lưu trữ các thông báo trong hệ thống cho người học.
    Bao gồm: nhắc ôn tập SRS, nhắc điểm danh hàng ngày, chúc mừng đạt chuỗi streak.
    """
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    notification_type: Mapped[NotificationType] = mapped_column(
        SqlEnum(
            NotificationType,
            name="notification_type",
            values_callable=enum_values,
            native_enum=False,
            create_constraint=True,
        ),
        default=NotificationType.SYSTEM,
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    link_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)
    scheduled_for: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )
