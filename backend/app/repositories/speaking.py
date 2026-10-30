from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models.speaking_attempt import SpeakingAttempt
from app.models.speaking_prompt import SpeakingPrompt
from app.models.speaking_usage import SpeakingAIUsage


class SpeakingRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_prompts(self) -> list[SpeakingPrompt]:
        return list(self.db.scalars(select(SpeakingPrompt).where(SpeakingPrompt.is_active.is_(True)).order_by(SpeakingPrompt.category, SpeakingPrompt.id)))

    def get_prompt(self, prompt_id: int) -> SpeakingPrompt | None:
        return self.db.scalar(select(SpeakingPrompt).where(SpeakingPrompt.id == prompt_id, SpeakingPrompt.is_active.is_(True)))

    def create_generated_prompt(self, values: dict[str, Any]) -> SpeakingPrompt:
        prompt = SpeakingPrompt(**values)
        self.db.add(prompt)
        # Flush lấy ID cho snapshot nhưng giữ prompt và attempt trong cùng transaction để tránh bản ghi mồ côi.
        self.db.flush()
        return prompt

    def create_attempt(self, user_id: int, prompt: SpeakingPrompt, snapshot: dict[str, Any]) -> SpeakingAttempt:
        attempt = SpeakingAttempt(user_id=user_id, prompt_id=prompt.id, prompt_snapshot=snapshot)
        self.db.add(attempt)
        self.db.commit()
        self.db.refresh(attempt)
        return attempt

    def get_attempt(self, attempt_id: int, user_id: int, *, lock: bool = False) -> SpeakingAttempt | None:
        statement = select(SpeakingAttempt).where(SpeakingAttempt.id == attempt_id, SpeakingAttempt.user_id == user_id)
        if lock:
            statement = statement.with_for_update()
        return self.db.scalar(statement)

    def list_attempts(self, user_id: int, limit: int = 20) -> tuple[list[SpeakingAttempt], int]:
        items = list(self.db.scalars(select(SpeakingAttempt).where(SpeakingAttempt.user_id == user_id).order_by(SpeakingAttempt.created_at.desc()).limit(limit)))
        total = self.db.scalar(select(func.count()).select_from(SpeakingAttempt).where(SpeakingAttempt.user_id == user_id)) or 0
        return items, total

    def usage_count(self, user_id: int, usage_date: date) -> int:
        return self.db.scalar(select(SpeakingAIUsage.used_count).where(SpeakingAIUsage.user_id == user_id, SpeakingAIUsage.usage_date == usage_date)) or 0

    def claim_transcription(self, attempt: SpeakingAttempt, quota: int | None, usage_date: date, stale_after: timedelta) -> SpeakingAttempt | None:
        now = datetime.now(timezone.utc)
        if attempt.status in {"transcribing", "grading"}:
            started = attempt.processing_started_at
            if started is None or started.replace(tzinfo=started.tzinfo or timezone.utc) + stale_after > now:
                return None
            attempt.status = "failed"
            attempt.error_code = "transcription_timeout" if attempt.transcript == "" else "grading_timeout"
            attempt.processing_started_at = None
            attempt.grading_token = None
            attempt.version += 1
        if attempt.transcript.strip():
            return None
        if attempt.status not in {"created", "failed"}:
            return None

        if not attempt.quota_consumed:
            # Upsert có điều kiện và đổi trạng thái attempt cùng transaction để request đồng thời không vượt quota.
            insert = sqlite_insert(SpeakingAIUsage) if self.db.bind and self.db.bind.dialect.name == "sqlite" else pg_insert(SpeakingAIUsage)
            statement = insert.values(user_id=attempt.user_id, usage_date=usage_date, used_count=1).on_conflict_do_update(
                index_elements=["user_id", "usage_date"],
                set_={"used_count": SpeakingAIUsage.used_count + 1, "updated_at": now},
                where=SpeakingAIUsage.used_count < quota if quota is not None else None,
            ).returning(SpeakingAIUsage.used_count)
            if self.db.scalar(statement) is None:
                self.db.rollback()
                return None
            # Thử lại sau lỗi provider dùng lại lượt đã giữ cho attempt, tránh trừ quota lần nữa.
            attempt.quota_consumed = True

        attempt.status = "transcribing"
        attempt.processing_started_at = now
        attempt.error_code = None
        attempt.version += 1
        self.db.commit()
        self.db.refresh(attempt)
        return attempt

    def finish_transcription(self, attempt_id: int, user_id: int, transcript: str) -> SpeakingAttempt | None:
        result = self.db.execute(update(SpeakingAttempt).where(
            SpeakingAttempt.id == attempt_id, SpeakingAttempt.user_id == user_id, SpeakingAttempt.status == "transcribing"
        ).values(transcript=transcript, status="ready", processing_started_at=None, error_code=None, version=SpeakingAttempt.version + 1))
        self.db.commit()
        return self.get_attempt(attempt_id, user_id) if result.rowcount else None

    def save_transcript(self, attempt_id: int, user_id: int, version: int, transcript: str) -> SpeakingAttempt | None:
        result = self.db.execute(update(SpeakingAttempt).where(
            SpeakingAttempt.id == attempt_id, SpeakingAttempt.user_id == user_id, SpeakingAttempt.version == version,
            SpeakingAttempt.status.in_(["ready", "graded", "failed"]),
        ).values(transcript=transcript, status="ready", feedback_json=None, graded_at=None, error_code=None,
                 processing_started_at=None, grading_token=None, version=SpeakingAttempt.version + 1))
        self.db.commit()
        return self.get_attempt(attempt_id, user_id) if result.rowcount else None

    def start_grading(self, attempt: SpeakingAttempt, expected_version: int) -> tuple[str, SpeakingAttempt] | None:
        if attempt.version != expected_version or not attempt.transcript.strip():
            return None
        if attempt.status == "grading":
            started = attempt.processing_started_at
            if started is None or started.replace(tzinfo=started.tzinfo or timezone.utc) + timedelta(seconds=300) > datetime.now(timezone.utc):
                return None
        if attempt.status not in {"ready", "failed", "grading"}:
            return None
        # So sánh version và token trước khi lưu để kết quả AI cũ không ghi đè transcript mới.
        token = str(uuid4())
        result = self.db.execute(update(SpeakingAttempt).where(
            SpeakingAttempt.id == attempt.id, SpeakingAttempt.user_id == attempt.user_id,
            SpeakingAttempt.version == expected_version,
        ).values(status="grading", grading_token=token, processing_started_at=datetime.now(timezone.utc), error_code=None,
                 version=SpeakingAttempt.version + 1))
        self.db.commit()
        if not result.rowcount:
            return None
        current = self.get_attempt(attempt.id, attempt.user_id)
        return (token, current) if current else None

    def complete_grade(self, attempt_id: int, user_id: int, token: str, feedback: dict[str, Any], model_name: str) -> SpeakingAttempt | None:
        now = datetime.now(timezone.utc)
        result = self.db.execute(update(SpeakingAttempt).where(
            SpeakingAttempt.id == attempt_id, SpeakingAttempt.user_id == user_id,
            SpeakingAttempt.status == "grading", SpeakingAttempt.grading_token == token,
        ).values(status="graded", feedback_json=feedback, model_name=model_name, graded_at=now,
                 processing_started_at=None, grading_token=None, error_code=None, version=SpeakingAttempt.version + 1))
        self.db.commit()
        return self.get_attempt(attempt_id, user_id) if result.rowcount else None

    def fail(self, attempt_id: int, user_id: int, token: str | None, error_code: str) -> None:
        statement = update(SpeakingAttempt).where(SpeakingAttempt.id == attempt_id, SpeakingAttempt.user_id == user_id)
        if token:
            statement = statement.where(SpeakingAttempt.grading_token == token)
        self.db.execute(statement.values(status="failed", error_code=error_code[:40], processing_started_at=None, grading_token=None, version=SpeakingAttempt.version + 1))
        self.db.commit()

    def recover_stale(self, attempts: list[SpeakingAttempt], stale_after: timedelta) -> None:
        now = datetime.now(timezone.utc)
        changed = False
        for attempt in attempts:
            if attempt.status not in {"transcribing", "grading"}:
                continue
            started = attempt.processing_started_at
            if started is None or started.replace(tzinfo=started.tzinfo or timezone.utc) + stale_after <= now:
                attempt.error_code = "transcription_timeout" if attempt.status == "transcribing" else "grading_timeout"
                attempt.status = "failed"
                attempt.processing_started_at = None
                attempt.grading_token = None
                attempt.version += 1
                changed = True
        if changed:
            self.db.commit()
