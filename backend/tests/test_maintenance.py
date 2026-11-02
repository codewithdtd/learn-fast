from datetime import datetime, timedelta, timezone

import pytest

from fastapi.testclient import TestClient

from sqlalchemy import select

from sqlalchemy.orm import Session



from app.main import app

from app.models import (

    GuestAIUsage,

    Notification,

    NotificationType,

    StudyDirection,

    StudyRoundScope,

    StudyRoundStatus,

    StudySession,

    StudySessionCard,

    StudySessionRound,

    StudySessionStatus,

    StudySessionType,

    StudySheet,

    User,

    Workbook,

    WritingAttempt,

    WritingPrompt,

)

from app.schemas.maintenance import StorageCleanupRequest

from app.services.maintenance import (

    execute_storage_cleanup,

    get_storage_cleanup_stats,

)

from app.services.notification import delete_read_notifications, delete_notification





@pytest.fixture

def test_setup_data(db_session: Session):

    """Khởi tạo workbook và sheet cơ bản phục vụ test session."""

    user = db_session.query(User).first()

    if not user:

        user = User(

            email="admin@example.com",

            username="admin",

            hashed_password="fakehash",

            is_superuser=True,

            is_active=True,

        )

        db_session.add(user)

        db_session.commit()



    wb = Workbook(name="Test Deck", original_filename="deck.xlsx", user_id=user.id)

    db_session.add(wb)

    db_session.commit()



    sheet = StudySheet(workbook_id=wb.id, name="Test Sheet", position=1, card_count=5)

    db_session.add(sheet)

    db_session.commit()



    return {"user": user, "sheet": sheet}





def test_maintenance_stats_and_cleanup(db_session: Session, test_setup_data: dict) -> None:

    sheet = test_setup_data["sheet"]

    user = test_setup_data["user"]

    now = datetime.now(timezone.utc)



    # 1. Tạo thông báo đã đọc và chưa đọc

    notif_read = Notification(

        notification_type=NotificationType.DAILY_CHECKIN,

        title="Đã đọc",

        message="Nội dung đã đọc",

        is_read=True,

        created_at=now - timedelta(days=2),

    )

    notif_fresh_unread = Notification(

        notification_type=NotificationType.SRS_DUE,

        title="Chưa đọc mới",

        message="Vừa tạo hôm nay",

        is_read=False,

        created_at=now,

        scheduled_for=now,

    )

    notif_stale_unread = Notification(

        notification_type=NotificationType.SRS_DUE,

        title="Chưa đọc cũ",

        message="Từ 40 ngày trước",

        is_read=False,

        created_at=now - timedelta(days=40),

        scheduled_for=now - timedelta(days=40),

    )

    db_session.add_all([notif_read, notif_fresh_unread, notif_stale_unread])



    # 2. Tạo guest study session cũ (> 7 ngày)

    guest_session = StudySession(

        user_id=None,

        guest_key_hash="guest_hash_123",

        sheet_id=sheet.id,

        session_type=StudySessionType.NEW_LEARNING,

        direction=StudyDirection.EN_TO_VI,

        status=StudySessionStatus.COMPLETED,

        total_cards=1,

        started_at=now - timedelta(days=10),

    )

    db_session.add(guest_session)

    db_session.commit()



    round_item = StudySessionRound(

        session_id=guest_session.id,

        round_number=1,

        scope=StudyRoundScope.ALL,

        status=StudyRoundStatus.COMPLETED,

        total_cards=1,

    )

    db_session.add(round_item)



    # 3. Tạo guest AI usage cũ (> 14 ngày)

    guest_ai = GuestAIUsage(

        guest_key_hash="ai_hash_abc",

        feature="sentence_feedback",

        used_at=now - timedelta(days=20),

    )

    db_session.add(guest_ai)

    db_session.commit()



    guest_session_id = guest_session.id

    round_id = round_item.id

    guest_ai_id = guest_ai.id

    notif_read_id = notif_read.id

    notif_stale_id = notif_stale_unread.id



    # 4. Kiểm tra get_storage_cleanup_stats

    stats = get_storage_cleanup_stats(db_session, now=now)

    assert stats.read_notifications >= 1

    assert stats.stale_unread_notifications >= 1

    assert stats.guest_study_sessions >= 1

    assert stats.guest_ai_usage_records >= 1

    assert stats.total_cleanable_records >= 4



    # 5. Thực thi dọn dẹp execute_storage_cleanup

    cleanup_req = StorageCleanupRequest(

        clear_read_notifications=True,

        clear_stale_notifications=True,

        stale_notifications_days=30,

        clear_guest_sessions=True,

        guest_sessions_days=7,

        clear_abandoned_sessions=True,

        abandoned_sessions_days=14,

        clear_guest_ai_usage=True,

        guest_ai_usage_days=14,

        clear_guest_ielts=True,

        clear_empty_drafts=True,

    )



    result = execute_storage_cleanup(db_session, cleanup_req, now=now)

    assert result.success is True

    assert result.total_deleted >= 4



    # 6. Kiểm chứng: Thông báo chưa đọc mới vẫn còn nguyên vẹn!

    fresh_remained = db_session.get(Notification, notif_fresh_unread.id)

    assert fresh_remained is not None

    assert fresh_remained.title == "Chưa đọc mới"



    # Thông báo đã đọc và thông báo cũ đã bị xóa

    assert db_session.scalar(select(Notification).where(Notification.id == notif_read_id)) is None

    assert db_session.scalar(select(Notification).where(Notification.id == notif_stale_id)) is None



    # Phiên học guest và rounds phụ thuộc đã được cascade delete sạch sẽ

    assert db_session.scalar(select(StudySession).where(StudySession.id == guest_session_id)) is None

    assert db_session.scalar(select(StudySessionRound).where(StudySessionRound.id == round_id)) is None



    # Guest AI usage record đã bị xóa

    assert db_session.scalar(select(GuestAIUsage).where(GuestAIUsage.id == guest_ai_id)) is None





def test_delete_read_notifications_direct(db_session: Session) -> None:

    now = datetime.now(timezone.utc)

    n1 = Notification(title="Read 1", message="m", is_read=True, created_at=now)

    n2 = Notification(title="Read 2", message="m", is_read=True, created_at=now)

    n3 = Notification(title="Unread", message="m", is_read=False, created_at=now)

    db_session.add_all([n1, n2, n3])

    db_session.commit()



    deleted = delete_read_notifications(db_session)

    assert deleted >= 2

    assert db_session.get(Notification, n1.id) is None

    assert db_session.get(Notification, n2.id) is None

    assert db_session.get(Notification, n3.id) is not None



    # Xóa 1 notification đơn lẻ

    single_deleted = delete_notification(db_session, n3.id)

    assert single_deleted is True

    assert db_session.get(Notification, n3.id) is None
def test_maintenance_and_notification_api_endpoints(db_session: Session, admin_api_client: TestClient) -> None:
    # 1. Tạo 1 notification đã đọc
    n = Notification(title="Test read notif", message="m", is_read=True)
    db_session.add(n)
    db_session.commit()

    # 2. GET /api/v1/maintenance/storage-stats
    res = admin_api_client.get("/api/v1/maintenance/storage-stats")
    assert res.status_code == 200
    data = res.json()
    assert "read_notifications" in data
    assert data["read_notifications"] >= 1

    # 3. DELETE /api/v1/notifications/read
    del_res = admin_api_client.delete("/api/v1/notifications/read")
    assert del_res.status_code == 200
    assert del_res.json()["deleted_count"] >= 1

    # 4. Tạo 1 notification mới và xóa theo ID
    n2 = Notification(title="Single delete", message="m", is_read=False)
    db_session.add(n2)
    db_session.commit()

    single_del = admin_api_client.delete(f"/api/v1/notifications/{n2.id}")
    assert single_del.status_code == 200
    assert single_del.json() == {"success": True}

    # 5. POST /api/v1/maintenance/cleanup
    clean_res = admin_api_client.post("/api/v1/maintenance/cleanup", json={"clear_read_notifications": True})
    assert clean_res.status_code == 200
    clean_data = clean_res.json()
    assert clean_data["success"] is True
    assert "total_deleted" in clean_data

