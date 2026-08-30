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
    unread_only: bool = Query(False, description="Filter for unread notifications only"),
    limit: int = Query(30, ge=1, le=100, description="Max notifications to retrieve"),
    db: Session = Depends(get_db),
) -> NotificationListResponse:
    """
    List notifications and unread count.
    """
    try:
        return get_user_notifications(db, unread_only=unread_only, limit=limit)
    except NotificationPersistenceError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not load notifications.",
        ) from error


@router.patch("/notifications/{notification_id}/read", status_code=status.HTTP_200_OK)
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    """
    Mark a specific notification as read.
    """
    try:
        success = mark_notification_as_read(db, notification_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found.",
            )
        return {"success": True}
    except NotificationPersistenceError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not update notification state.",
        ) from error


@router.post("/notifications/read-all", response_model=MarkReadResponse)
def mark_all_read(
    db: Session = Depends(get_db),
) -> MarkReadResponse:
    """
    Mark all notifications as read.
    """
    try:
        return mark_all_notifications_as_read(db)
    except NotificationPersistenceError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not mark all notifications as read.",
        ) from error

