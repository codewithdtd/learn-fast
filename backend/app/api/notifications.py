from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.notification import MarkReadResponse, NotificationListResponse
from app.services.notification import (
    NotificationPersistenceError,
    get_user_notifications,
    mark_all_notifications_as_read,
    mark_notification_as_read,
)


router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=NotificationListResponse)
def list_notifications(
    unread_only: bool = Query(False, description="Chỉ lấy thông báo chưa đọc"),
    limit: int = Query(30, ge=1, le=100, description="Giới hạn số lượng thông báo"),
    db: Session = Depends(get_db),
) -> NotificationListResponse:
    """
    Lấy danh sách thông báo và số lượng chưa đọc.
    """
    try:
        return get_user_notifications(db, unread_only=unread_only, limit=limit)
    except NotificationPersistenceError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể tải danh sách thông báo.",
        ) from error


@router.patch("/notifications/{notification_id}/read", status_code=status.HTTP_200_OK)
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    """
    Đánh dấu 1 thông báo cụ thể là đã đọc.
    """
    try:
        success = mark_notification_as_read(db, notification_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy thông báo.",
            )
        return {"success": True}
    except NotificationPersistenceError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể cập nhật trạng thái thông báo.",
        ) from error


@router.post("/notifications/read-all", response_model=MarkReadResponse)
def mark_all_read(
    db: Session = Depends(get_db),
) -> MarkReadResponse:
    """
    Đánh dấu tất cả thông báo là đã đọc.
    """
    try:
        return mark_all_notifications_as_read(db)
    except NotificationPersistenceError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể đánh dấu đã đọc tất cả thông báo.",
        ) from error
