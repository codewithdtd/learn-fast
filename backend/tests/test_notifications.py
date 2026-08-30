from datetime import datetime, timezone
import pytest
from sqlalchemy.orm import Session

from app.models import Notification, NotificationType, SheetPriority, SheetStatus, StudySheet, Workbook
from app.services.notification import (
    get_user_notifications,
    mark_all_notifications_as_read,
    mark_notification_as_read,
)


def test_notification_service(db_session: Session) -> None:
    # 1. Ban đầu tạo thông báo
    notif1 = Notification(
        notification_type=NotificationType.DAILY_CHECKIN,
        title="Nhắc nhở học",
        message="Hôm nay hãy học nhé",
        link_url="/calendar",
        is_read=False,
    )
    notif2 = Notification(
        notification_type=NotificationType.SRS_DUE,
        title="Nhắc ôn tập",
        message="Bạn có 2 bài cần ôn",
        link_url="/sheets/1/study",
        is_read=False,
    )
    db_session.add_all([notif1, notif2])
    db_session.commit()

    # 2. Get notifications
    res = get_user_notifications(db_session)
    assert res.total_count >= 2
    assert res.unread_count >= 2

    # 3. Mark 1 as read
    success = mark_notification_as_read(db_session, notif1.id)
    assert success is True

    unread_res = get_user_notifications(db_session, unread_only=True)
    assert any(n.id == notif2.id for n in unread_res.items)
    assert not any(n.id == notif1.id for n in unread_res.items)

    # 4. Mark all read
    mark_res = mark_all_notifications_as_read(db_session)
    assert mark_res.success is True
    assert mark_res.updated_count >= 1

    final_res = get_user_notifications(db_session)
    assert final_res.unread_count == 0
