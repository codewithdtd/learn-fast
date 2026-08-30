from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.models.enums import NotificationType


class NotificationItem(BaseModel):
    """Schema dữ liệu hiển thị một thông báo."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    notification_type: NotificationType
    title: str
    message: str
    link_url: str | None
    is_read: bool
    scheduled_for: datetime
    created_at: datetime


class NotificationListResponse(BaseModel):
    """Danh sách thông báo trả về kèm số lượng chưa đọc."""
    items: list[NotificationItem]
    unread_count: int
    total_count: int


class MarkReadResponse(BaseModel):
    """Kết quả sau khi đánh dấu đã đọc thông báo."""
    success: bool
    updated_count: int
