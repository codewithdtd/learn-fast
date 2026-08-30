from datetime import datetime, timezone
import logging

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import Notification, NotificationType, SheetStatus, StudySession, StudySessionStatus, StudySheet
from app.schemas.notification import MarkReadResponse, NotificationItem, NotificationListResponse
from app.services.srs import list_due_sheets


logger = logging.getLogger(__name__)


class NotificationPersistenceError(RuntimeError):
    """Bắn ra khi thao tác với bảng notification gặp lỗi."""


def generate_daily_learning_notifications(
    db: Session,
    *,
    now: datetime | None = None,
) -> None:
    """
    Tự động kiểm tra và tạo các thông báo cần thiết nếu chưa có thông báo tương tự trong ngày:
    1. Thông báo nhắc ôn tập khi có sheet đến hạn (srs_due).
    2. Thông báo nhắc nhở điểm danh hàng ngày nếu hôm nay chưa học (daily_checkin).
    """
    current_dt = now or datetime.now(timezone.utc)
    today_start = current_dt.replace(hour=0, minute=0, second=0, microsecond=0)

    try:
        # 1. Kiểm tra Due Sheets
        due_sheets = list_due_sheets(db, now=current_dt)
        if due_sheets:
            # Kiểm tra xem hôm nay đã tạo notification srs_due chưa
            existing_due_notif = db.scalar(
                select(Notification).where(
                    Notification.notification_type == NotificationType.SRS_DUE,
                    Notification.created_at >= today_start,
                )
            )
            if not existing_due_notif:
                count = len(due_sheets)
                title = f"You have {count} sheet{'s' if count > 1 else ''} due for review today!"
                message = f"You have {count} learning sheet{'s' if count > 1 else ''} scheduled for SRS review. Practice now to retain long-term memory!"
                link_url = f"/sheets/{due_sheets[0].id}/study?mode=review"
                notif = Notification(
                    notification_type=NotificationType.SRS_DUE,
                    title=title,
                    message=message,
                    link_url=link_url,
                    is_read=False,
                    scheduled_for=current_dt,
                )
                db.add(notif)
                db.commit()

        # 2. Kiểm tra xem hôm nay đã học chưa (daily checkin reminder)
        has_studied_today = db.scalar(
            select(func.count(StudySession.id)).where(
                StudySession.status == StudySessionStatus.COMPLETED,
                StudySession.completed_at >= today_start,
            )
        )
        if not has_studied_today:
            existing_checkin_notif = db.scalar(
                select(Notification).where(
                    Notification.notification_type == NotificationType.DAILY_CHECKIN,
                    Notification.created_at >= today_start,
                )
            )
            if not existing_checkin_notif:
                notif = Notification(
                    notification_type=NotificationType.DAILY_CHECKIN,
                    title="Don't forget your daily study check-in! 🔥",
                    message="Complete at least one session today to maintain your learning habit and keep your streak alive.",
                    link_url="/calendar",
                    is_read=False,
                    scheduled_for=current_dt,
                )
                db.add(notif)
                db.commit()


    except SQLAlchemyError as error:
        db.rollback()
        logger.warning(f"Failed to auto-generate daily notifications: {error}")


def get_user_notifications(
    db: Session,
    *,
    unread_only: bool = False,
    limit: int = 30,
) -> NotificationListResponse:
    """
    Lấy danh sách thông báo của người dùng và số lượng chưa đọc.
    """
    try:
        # Tự động sinh notification trước khi lấy
        generate_daily_learning_notifications(db)

        query = select(Notification).order_by(Notification.created_at.desc(), Notification.id.desc())
        if unread_only:
            query = query.where(Notification.is_read.is_(False))
        
        query = query.limit(limit)
        notifications = db.scalars(query).all()

        unread_count = db.scalar(
            select(func.count(Notification.id)).where(Notification.is_read.is_(False))
        ) or 0

        total_count = db.scalar(select(func.count(Notification.id))) or 0

        items = [
            NotificationItem(
                id=n.id,
                notification_type=n.notification_type,
                title=n.title,
                message=n.message,
                link_url=n.link_url,
                is_read=n.is_read,
                scheduled_for=n.scheduled_for,
                created_at=n.created_at,
            )
            for n in notifications
        ]

        return NotificationListResponse(
            items=items,
            unread_count=int(unread_count),
            total_count=int(total_count),
        )

    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Failed to retrieve notifications.")
        raise NotificationPersistenceError("Could not retrieve notifications.") from error


def mark_notification_as_read(db: Session, notification_id: int) -> bool:
    """Đánh dấu một thông báo là đã đọc."""
    try:
        notif = db.get(Notification, notification_id)
        if not notif:
            return False
        notif.is_read = True
        db.commit()
        return True
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception(f"Failed to mark notification {notification_id} as read.")
        raise NotificationPersistenceError("Could not update notification state.") from error


def mark_all_notifications_as_read(db: Session) -> MarkReadResponse:
    """Đánh dấu tất cả thông báo là đã đọc."""
    try:
        result = db.scalars(
            select(Notification).where(Notification.is_read.is_(False))
        ).all()
        count = len(result)
        for n in result:
            n.is_read = True
        db.commit()
        return MarkReadResponse(success=True, updated_count=count)
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Failed to mark all notifications as read.")
        raise NotificationPersistenceError("Could not update notifications.") from error
