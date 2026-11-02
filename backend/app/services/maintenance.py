from datetime import datetime, timedelta, timezone
import logging
from typing import Any

from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import (
    GuestAIUsage,
    IELTSPracticeSource,
    Notification,
    StudySession,
    StudySessionStatus,
    WritingAttempt,
)
from app.schemas.maintenance import (
    StorageCleanupRequest,
    StorageCleanupResponse,
    StorageCleanupStats,
)

logger = logging.getLogger(__name__)


class MaintenanceExecutionError(RuntimeError):
    """Lỗi phát sinh khi thực thi tác vụ bảo trì và dọn dẹp cơ sở dữ liệu."""


def get_storage_cleanup_stats(
    db: Session,
    *,
    now: datetime | None = None,
) -> StorageCleanupStats:
    """
    Tính toán số lượng bản ghi rác / dữ liệu thừa trong Neon PostgreSQL.
    Thao tác đọc (read-only), không chỉnh sửa hay xóa bất kỳ bản ghi nào.
    """
    current_dt = now or datetime.now(timezone.utc)

    try:
        # 1. Thông báo đã đọc
        read_notifs_count = db.scalar(
            select(func.count(Notification.id)).where(Notification.is_read.is_(True))
        ) or 0

        # 2. Thông báo chưa đọc cũ (>30 ngày)
        stale_cutoff = current_dt - timedelta(days=30)
        stale_notifs_count = db.scalar(
            select(func.count(Notification.id)).where(
                Notification.is_read.is_(False),
                Notification.scheduled_for <= stale_cutoff,
            )
        ) or 0

        # 3. Phiên học của khách vãng lai (>7 ngày)
        guest_session_cutoff = current_dt - timedelta(days=7)
        guest_sessions_count = db.scalar(
            select(func.count(StudySession.id)).where(
                or_(StudySession.user_id.is_(None), StudySession.guest_key_hash.is_not(None)),
                StudySession.started_at <= guest_session_cutoff,
            )
        ) or 0

        # 4. Phiên học active bị bỏ dở (>14 ngày)
        abandoned_cutoff = current_dt - timedelta(days=14)
        abandoned_sessions_count = db.scalar(
            select(func.count(StudySession.id)).where(
                StudySession.status == StudySessionStatus.ACTIVE,
                StudySession.started_at <= abandoned_cutoff,
            )
        ) or 0

        # 5. Bản ghi tracking quota guest AI (>14 ngày)
        guest_ai_cutoff = current_dt - timedelta(days=14)
        guest_ai_count = db.scalar(
            select(func.count(GuestAIUsage.id)).where(
                GuestAIUsage.used_at <= guest_ai_cutoff
            )
        ) or 0

        # 6. Dữ liệu nguồn đọc IELTS nháp của khách (>7 ngày)
        guest_ielts_cutoff = current_dt - timedelta(days=7)
        guest_ielts_count = db.scalar(
            select(func.count(IELTSPracticeSource.id)).where(
                IELTSPracticeSource.guest_key_hash.is_not(None),
                IELTSPracticeSource.created_at <= guest_ielts_cutoff,
            )
        ) or 0

        # 7. Bản nháp bài viết trống không có nội dung (>7 ngày)
        empty_drafts_cutoff = current_dt - timedelta(days=7)
        empty_drafts_count = db.scalar(
            select(func.count(WritingAttempt.id)).where(
                WritingAttempt.status == "draft",
                or_(WritingAttempt.draft_text == "", WritingAttempt.word_count == 0),
                WritingAttempt.created_at <= empty_drafts_cutoff,
            )
        ) or 0

        total = (
            read_notifs_count
            + stale_notifs_count
            + guest_sessions_count
            + abandoned_sessions_count
            + guest_ai_count
            + guest_ielts_count
            + empty_drafts_count
        )

        return StorageCleanupStats(
            read_notifications=int(read_notifs_count),
            stale_unread_notifications=int(stale_notifs_count),
            guest_study_sessions=int(guest_sessions_count),
            abandoned_study_sessions=int(abandoned_sessions_count),
            guest_ai_usage_records=int(guest_ai_count),
            guest_ielts_records=int(guest_ielts_count),
            empty_writing_drafts=int(empty_drafts_count),
            total_cleanable_records=int(total),
        )

    except SQLAlchemyError as error:
        logger.exception("Failed to compute database storage cleanup stats.")
        raise MaintenanceExecutionError("Could not inspect database storage stats.") from error


def execute_storage_cleanup(
    db: Session,
    request: StorageCleanupRequest,
    *,
    now: datetime | None = None,
) -> StorageCleanupResponse:
    """
    Thực hiện dọn dẹp các loại dữ liệu thừa theo tùy chọn được cấu hình trong request.
    Chạy trong một transaction an toàn, rollback nếu có bất kỳ lỗi nào xảy ra.
    """
    current_dt = now or datetime.now(timezone.utc)
    deleted_counts: dict[str, int] = {}

    try:
        # 1. Dọn dẹp thông báo đã đọc
        if request.clear_read_notifications:
            read_notifs = db.scalars(
                select(Notification).where(Notification.is_read.is_(True))
            ).all()
            count = len(read_notifs)
            for item in read_notifs:
                db.delete(item)
            deleted_counts["read_notifications"] = count

        # 2. Dọn dẹp thông báo chưa đọc quá cũ
        if request.clear_stale_notifications:
            stale_cutoff = current_dt - timedelta(days=request.stale_notifications_days)
            stale_notifs = db.scalars(
                select(Notification).where(
                    Notification.is_read.is_(False),
                    Notification.scheduled_for <= stale_cutoff,
                )
            ).all()
            count = len(stale_notifs)
            for item in stale_notifs:
                db.delete(item)
            deleted_counts["stale_unread_notifications"] = count

        # 3. Dọn dẹp các phiên học của khách vãng lai
        # (Cascade delete tự động xóa cả study_session_cards, rounds, round_cards)
        if request.clear_guest_sessions:
            guest_cutoff = current_dt - timedelta(days=request.guest_sessions_days)
            guest_sessions = db.scalars(
                select(StudySession).where(
                    or_(StudySession.user_id.is_(None), StudySession.guest_key_hash.is_not(None)),
                    StudySession.started_at <= guest_cutoff,
                )
            ).all()
            count = len(guest_sessions)
            for session in guest_sessions:
                db.delete(session)
            deleted_counts["guest_study_sessions"] = count

        # 4. Dọn dẹp các phiên học bị bỏ dở (active lâu ngày không tiếp tục)
        if request.clear_abandoned_sessions:
            abandoned_cutoff = current_dt - timedelta(days=request.abandoned_sessions_days)
            abandoned_sessions = db.scalars(
                select(StudySession).where(
                    StudySession.status == StudySessionStatus.ACTIVE,
                    StudySession.started_at <= abandoned_cutoff,
                )
            ).all()
            count = len(abandoned_sessions)
            for session in abandoned_sessions:
                db.delete(session)
            deleted_counts["abandoned_study_sessions"] = count

        # 5. Dọn dẹp tracking quota guest AI
        if request.clear_guest_ai_usage:
            guest_ai_cutoff = current_dt - timedelta(days=request.guest_ai_usage_days)
            guest_ai_items = db.scalars(
                select(GuestAIUsage).where(
                    GuestAIUsage.used_at <= guest_ai_cutoff
                )
            ).all()
            count = len(guest_ai_items)
            for item in guest_ai_items:
                db.delete(item)
            deleted_counts["guest_ai_usage"] = count

        # 6. Dọn dẹp dữ liệu bài đọc IELTS của khách vãng lai
        # (Cascade delete tự động xóa cả practice_test_sets và attempts của guest)
        if request.clear_guest_ielts:
            guest_ielts_cutoff = current_dt - timedelta(days=request.guest_ielts_days)
            guest_ielts_items = db.scalars(
                select(IELTSPracticeSource).where(
                    IELTSPracticeSource.guest_key_hash.is_not(None),
                    IELTSPracticeSource.created_at <= guest_ielts_cutoff,
                )
            ).all()
            count = len(guest_ielts_items)
            for item in guest_ielts_items:
                db.delete(item)
            deleted_counts["guest_ielts_sources"] = count

        # 7. Dọn dẹp bản nháp bài viết trống
        if request.clear_empty_drafts:
            empty_drafts_cutoff = current_dt - timedelta(days=request.empty_drafts_days)
            empty_drafts = db.scalars(
                select(WritingAttempt).where(
                    WritingAttempt.status == "draft",
                    or_(WritingAttempt.draft_text == "", WritingAttempt.word_count == 0),
                    WritingAttempt.created_at <= empty_drafts_cutoff,
                )
            ).all()
            count = len(empty_drafts)
            for item in empty_drafts:
                db.delete(item)
            deleted_counts["empty_writing_drafts"] = count

        db.commit()

        total = sum(deleted_counts.values())
        msg = f"Đã dọn dẹp thành công {total} bản ghi dữ liệu thừa, giải phóng dung lượng Neon PostgreSQL."
        logger.info(f"Database storage cleanup executed: {deleted_counts} (total {total})")

        return StorageCleanupResponse(
            success=True,
            deleted_counts=deleted_counts,
            total_deleted=total,
            message=msg,
        )

    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Failed to execute database storage cleanup.")
        raise MaintenanceExecutionError("Could not execute database storage cleanup.") from error
