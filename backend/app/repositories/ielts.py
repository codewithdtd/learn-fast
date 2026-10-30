from datetime import timedelta

from sqlalchemy import and_, delete, func, select, update
from sqlalchemy.orm import Session

from app.models.ielts_attempt import IELTSPracticeAttempt
from app.models.ielts_source import IELTSPracticeSource
from app.models.ielts_test_set import IELTSPracticeTestSet
from app.models.mixins import utc_now


class IELTSRepository:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def scope(model, user_id: int | None, guest_hash: str | None):
        if user_id is not None:
            return model.user_id == user_id
        # Dữ liệu bài thử của guest chỉ có hiệu lực 24 giờ và không thuộc user nào.
        return and_(model.user_id.is_(None), model.guest_key_hash == guest_hash,
                    model.created_at >= utc_now() - timedelta(hours=24))

    def clean_expired_guest_sources(self) -> int:
        ids = list(self.db.scalars(select(IELTSPracticeSource.id).where(
            IELTSPracticeSource.user_id.is_(None),
            IELTSPracticeSource.created_at < utc_now() - timedelta(hours=24),
        ).limit(100)))
        if ids:
            self.db.execute(delete(IELTSPracticeSource).where(IELTSPracticeSource.id.in_(ids)))
            self.db.commit()
        return len(ids)

    def count_sources(self, user_id: int | None, guest_hash: str | None) -> int:
        return self.db.scalar(select(func.count()).select_from(IELTSPracticeSource).where(
            self.scope(IELTSPracticeSource, user_id, guest_hash),
            IELTSPracticeSource.created_at >= utc_now() - timedelta(hours=24),
        )) or 0

    def expire_stale_generation(self) -> None:
        result = self.db.execute(update(IELTSPracticeTestSet).where(
            IELTSPracticeTestSet.status == "generating",
            IELTSPracticeTestSet.created_at < utc_now() - timedelta(minutes=2),
        ).values(status="failed", error_code="generation_interrupted", updated_at=utc_now()))
        if result.rowcount:
            self.db.commit()

    def source(self, source_id: int, user_id: int | None, guest_hash: str | None) -> IELTSPracticeSource | None:
        return self.db.scalar(select(IELTSPracticeSource).where(IELTSPracticeSource.id == source_id, self.scope(IELTSPracticeSource, user_id, guest_hash)))

    def test_set(self, test_id: int, user_id: int | None, guest_hash: str | None) -> tuple[IELTSPracticeTestSet, IELTSPracticeSource] | None:
        return self.db.execute(select(IELTSPracticeTestSet, IELTSPracticeSource).join(IELTSPracticeSource).where(
            IELTSPracticeTestSet.id == test_id, self.scope(IELTSPracticeSource, user_id, guest_hash)
        )).first()

    def attempt(self, attempt_id: int, user_id: int | None, guest_hash: str | None) -> tuple[IELTSPracticeAttempt, IELTSPracticeTestSet, IELTSPracticeSource] | None:
        return self.db.execute(select(IELTSPracticeAttempt, IELTSPracticeTestSet, IELTSPracticeSource)
            .join(IELTSPracticeTestSet, IELTSPracticeAttempt.test_set_id == IELTSPracticeTestSet.id)
            .join(IELTSPracticeSource, IELTSPracticeTestSet.source_id == IELTSPracticeSource.id)
            .where(IELTSPracticeAttempt.id == attempt_id, self.scope(IELTSPracticeSource, user_id, guest_hash),
                   self.scope(IELTSPracticeAttempt, user_id, guest_hash))).first()

    def list_tests(self, user_id: int | None, guest_hash: str | None, limit: int, offset: int) -> tuple[list[tuple[IELTSPracticeTestSet, IELTSPracticeSource]], int]:
        scope = self.scope(IELTSPracticeSource, user_id, guest_hash)
        total = self.db.scalar(select(func.count()).select_from(IELTSPracticeTestSet)
            .join(IELTSPracticeSource).where(scope)) or 0
        items = list(self.db.execute(select(IELTSPracticeTestSet, IELTSPracticeSource).join(IELTSPracticeSource)
            .where(scope).order_by(IELTSPracticeTestSet.id.desc()).limit(limit).offset(offset)))
        return items, total

    def list_attempts(self, user_id: int | None, guest_hash: str | None, limit: int, offset: int) -> tuple[list[IELTSPracticeAttempt], int]:
        scope = self.scope(IELTSPracticeAttempt, user_id, guest_hash)
        total = self.db.scalar(select(func.count()).select_from(IELTSPracticeAttempt).where(scope)) or 0
        items = list(self.db.scalars(select(IELTSPracticeAttempt).where(scope)
            .order_by(IELTSPracticeAttempt.id.desc()).limit(limit).offset(offset)))
        return items, total

    def finish_generation(self, test_id: int, questions: dict) -> bool:
        # Điều kiện status giữ cho request cũ không ghi đè đề đã hoàn tất.
        result = self.db.execute(update(IELTSPracticeTestSet).where(
            IELTSPracticeTestSet.id == test_id, IELTSPracticeTestSet.status == "generating"
        ).values(status="ready", questions_json=questions, updated_at=utc_now()))
        self.db.commit()
        return result.rowcount == 1

    def submit(self, attempt_id: int, score: int) -> bool:
        # UPDATE có điều kiện bảo đảm hai lần nộp đồng thời chỉ ghi một điểm.
        result = self.db.execute(update(IELTSPracticeAttempt).where(
            IELTSPracticeAttempt.id == attempt_id, IELTSPracticeAttempt.status == "draft"
        ).values(status="submitted", score=score, submitted_at=utc_now(), updated_at=utc_now()))
        self.db.commit()
        return result.rowcount == 1
