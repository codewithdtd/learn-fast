from datetime import date, datetime

from sqlalchemy import func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models.writing_attempt import WritingAttempt
from app.models.writing_prompt import WritingPrompt
from app.models.writing_usage import WritingAIUsage
from app.models.mixins import utc_now


class WritingRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_prompts(self) -> list[WritingPrompt]:
        return list(self.db.scalars(
            select(WritingPrompt).where(WritingPrompt.is_active.is_(True)).order_by(WritingPrompt.id)
        ))

    def get_prompt(self, prompt_id: int) -> WritingPrompt | None:
        return self.db.scalar(
            select(WritingPrompt).where(WritingPrompt.id == prompt_id, WritingPrompt.is_active.is_(True))
        )

    def get_attempt(self, attempt_id: int, user_id: int) -> WritingAttempt | None:
        return self.db.scalar(
            select(WritingAttempt).where(
                WritingAttempt.id == attempt_id, WritingAttempt.user_id == user_id
            )
        )

    def create_attempt(
        self,
        user_id: int,
        prompt: WritingPrompt,
        snapshot: dict,
        revision_of_id: int | None,
    ) -> WritingAttempt:
        attempt = WritingAttempt(
            user_id=user_id,
            prompt_id=prompt.id,
            prompt_snapshot=snapshot,
            revision_of_id=revision_of_id,
        )
        self.db.add(attempt)
        self.db.commit()
        self.db.refresh(attempt)
        return attempt

    def save_draft(
        self, attempt_id: int, user_id: int, expected_version: int, draft_text: str, word_count: int
    ) -> bool:
        result = self.db.execute(
            update(WritingAttempt)
            .where(
                WritingAttempt.id == attempt_id,
                WritingAttempt.user_id == user_id,
                WritingAttempt.status.in_(["draft", "failed"]),
                WritingAttempt.version == expected_version,
            )
            .values(
                draft_text=draft_text,
                word_count=word_count,
                status="draft",
                error_code=None,
                version=WritingAttempt.version + 1,
                updated_at=utc_now(),
            )
        )
        self.db.commit()
        return result.rowcount == 1

    def expire_stale_grading(
        self, user_id: int, cutoff: datetime, attempt_id: int | None = None
    ) -> int:
        # Điều kiện SQL bảo vệ lượt chấm vừa hoàn tất hoặc lượt mới khi GET và worker chạy đồng thời.
        conditions = [
            WritingAttempt.user_id == user_id,
            WritingAttempt.status == "grading",
            or_(WritingAttempt.grading_started_at <= cutoff, WritingAttempt.grading_started_at.is_(None)),
        ]
        if attempt_id is not None:
            conditions.append(WritingAttempt.id == attempt_id)
        result = self.db.execute(
            update(WritingAttempt).where(*conditions).values(
                status="failed",
                error_code="grading_timeout",
                grading_token=None,
                grading_started_at=None,
                version=WritingAttempt.version + 1,
                updated_at=utc_now(),
            ).execution_options(synchronize_session=False)
        )
        self.db.commit()
        return result.rowcount

    def list_attempts(
        self, user_id: int, page: int, page_size: int, prompt_id: int | None, status_filter: str | None
    ) -> tuple[list[WritingAttempt], int]:
        conditions = [WritingAttempt.user_id == user_id]
        if prompt_id is not None:
            conditions.append(WritingAttempt.prompt_id == prompt_id)
        if status_filter is not None:
            conditions.append(WritingAttempt.status == status_filter)
        total = self.db.scalar(select(func.count()).select_from(WritingAttempt).where(*conditions)) or 0
        rows = list(self.db.scalars(
            select(WritingAttempt)
            .where(*conditions)
            .order_by(WritingAttempt.created_at.desc(), WritingAttempt.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ))
        return rows, total

    def consume_quota(self, user_id: int, usage_date: date, limit: int) -> int | None:
        # Dùng UPSERT có điều kiện để nhiều API worker không thể cùng vượt giới hạn trong một ngày.
        values = {"user_id": user_id, "usage_date": usage_date, "used_count": 1}
        if self.db.bind is not None and self.db.bind.dialect.name == "postgresql":
            statement = postgres_insert(WritingAIUsage).values(**values)
        else:
            statement = sqlite_insert(WritingAIUsage).values(**values)
        table = WritingAIUsage.__table__
        statement = statement.on_conflict_do_update(
            index_elements=[table.c.user_id, table.c.usage_date],
            set_={
                "used_count": table.c.used_count + 1,
                "updated_at": utc_now(),
            },
            where=table.c.used_count < limit,
        ).returning(table.c.used_count)
        return self.db.scalar(statement)

    def consume_topic_generation_quota(
        self, user_id: int, usage_date: date, limit: int
    ) -> int | None:
        # UPSERT có điều kiện giữ quota chính xác khi người dùng gửi nhiều request tạo đề đồng thời.
        values = {
            "user_id": user_id,
            "usage_date": usage_date,
            "topic_generation_count": 1,
        }
        if self.db.bind is not None and self.db.bind.dialect.name == "postgresql":
            statement = postgres_insert(WritingAIUsage).values(**values)
        else:
            statement = sqlite_insert(WritingAIUsage).values(**values)
        table = WritingAIUsage.__table__
        statement = statement.on_conflict_do_update(
            index_elements=[table.c.user_id, table.c.usage_date],
            set_={
                "topic_generation_count": table.c.topic_generation_count + 1,
                "updated_at": utc_now(),
            },
            where=table.c.topic_generation_count < limit,
        ).returning(table.c.topic_generation_count)
        return self.db.scalar(statement)

    def create_ai_prompt(self, values: dict) -> WritingPrompt:
        prompt = WritingPrompt(**values, is_active=False)
        self.db.add(prompt)
        self.db.flush()
        return prompt

    def current_usage(self, user_id: int, usage_date: date) -> int:
        return self.db.scalar(
            select(WritingAIUsage.used_count).where(
                WritingAIUsage.user_id == user_id,
                WritingAIUsage.usage_date == usage_date,
            )
        ) or 0

    def claim_grading(
        self,
        attempt: WritingAttempt,
        expected_version: int,
        token: str,
        now: datetime,
        usage_date: date,
        quota: int,
    ) -> tuple[str | None, int | None]:
        """Claim quota and a draft before AI; commit now so the network wait holds no DB lock."""
        # Quota và trạng thái được commit cùng nhau; nếu CAS thua thì rollback cả lượt quota.
        used = self.consume_quota(attempt.user_id, usage_date, quota)
        if used is None:
            self.db.rollback()
            return None, None

        eligible_statuses = ["draft", "failed"]
        if attempt.status == "grading":
            eligible_statuses.append("grading")
        result = self.db.execute(
            update(WritingAttempt)
            .where(
                WritingAttempt.id == attempt.id,
                WritingAttempt.user_id == attempt.user_id,
                WritingAttempt.version == expected_version,
                WritingAttempt.status.in_(eligible_statuses),
            )
            .values(
                status="grading",
                submitted_text=attempt.draft_text,
                word_count=len(attempt.draft_text.split()),
                submitted_at=now,
                grading_started_at=now,
                grading_token=token,
                error_code=None,
                version=WritingAttempt.version + 1,
                updated_at=now,
            )
        )
        if result.rowcount != 1:
            self.db.rollback()
            return "conflict", None
        self.db.commit()
        return token, used

    def complete_grading(
        self,
        attempt_id: int,
        user_id: int,
        token: str,
        feedback: dict,
        score: float,
        model_name: str,
        now: datetime,
    ) -> bool:
        result = self.db.execute(
            update(WritingAttempt)
            .where(
                WritingAttempt.id == attempt_id,
                WritingAttempt.user_id == user_id,
                WritingAttempt.status == "grading",
                WritingAttempt.grading_token == token,
            )
            .values(
                status="graded",
                feedback_json=feedback,
                practice_score=score,
                model_name=model_name[:120],
                rubric_version=feedback["rubric_version"],
                graded_at=now,
                grading_started_at=None,
                grading_token=None,
                error_code=None,
                version=WritingAttempt.version + 1,
                updated_at=now,
            )
        )
        self.db.commit()
        return result.rowcount == 1

    def fail_grading(self, attempt_id: int, user_id: int, token: str, error_code: str) -> None:
        self.db.execute(
            update(WritingAttempt)
            .where(
                WritingAttempt.id == attempt_id,
                WritingAttempt.user_id == user_id,
                WritingAttempt.status == "grading",
                WritingAttempt.grading_token == token,
            )
            .values(
                status="failed",
                error_code=error_code,
                grading_started_at=None,
                grading_token=None,
                updated_at=utc_now(),
            )
        )
        self.db.commit()
