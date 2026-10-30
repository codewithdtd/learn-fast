from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.writing import (
    AttemptCreate,
    AttemptGrade,
    AttemptSave,
    WritingAttemptList,
    WritingAttemptRead,
    WritingPromptList,
    WritingPromptRead,
    WritingUsageRead,
    WritingErrorHistory,
)
from app.services import writing as writing_service
from app.services.sentence_practice import create_sentence_attempt
from app.schemas.sentence_practice import SentenceAttemptCreate
from app.schemas.paragraph_practice import ParagraphPracticeCreate
from app.services.paragraph_practice import create_paragraph_attempt
from app.services.guest_ai_quota import account_trial_used, provider_trial
from app.repositories.writing import WritingRepository


router = APIRouter(prefix="/writing", tags=["writing"])


@router.get("/prompts", response_model=WritingPromptList)
def prompts(db: Session = Depends(get_db)) -> WritingPromptList:
    return writing_service.list_prompts(db)


@router.get("/prompts/{prompt_id}", response_model=WritingPromptRead)
def prompt_detail(prompt_id: int, db: Session = Depends(get_db)) -> WritingPromptRead:
    return writing_service.get_prompt(db, prompt_id)


@router.post("/attempts", response_model=WritingAttemptRead, status_code=status.HTTP_201_CREATED)
def create_attempt(
    payload: AttemptCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WritingAttemptRead:
    return writing_service.create_attempt(
        db, current_user.id, payload.prompt_id, payload.revision_of_id
    )


@router.post(
    "/attempts/sentence",
    response_model=WritingAttemptRead,
    status_code=status.HTTP_201_CREATED,
)
def sentence_attempt(
    payload: SentenceAttemptCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WritingAttemptRead:
    with provider_trial(db, request, "sentence_topic", current_user):
        return create_sentence_attempt(db, current_user.id, payload.flashcard_id, is_admin=current_user.is_superuser)


@router.post(
    "/attempts/vocabulary-paragraph",
    response_model=WritingAttemptRead,
    status_code=status.HTTP_201_CREATED,
)
def vocabulary_paragraph_attempt(
    payload: ParagraphPracticeCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WritingAttemptRead:
    with provider_trial(db, request, "vocabulary_paragraph_topic", current_user):
        return create_paragraph_attempt(db, current_user, payload)


@router.post(
    "/attempts/random",
    response_model=WritingAttemptRead,
    status_code=status.HTTP_201_CREATED,
)
def generate_random_attempt(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WritingAttemptRead:
    with provider_trial(db, request, "writing_topic", current_user):
        return writing_service.generate_random_attempt(
            db, current_user.id, is_admin=current_user.is_superuser
        )


@router.patch("/attempts/{attempt_id}", response_model=WritingAttemptRead)
def save_attempt(
    attempt_id: int,
    payload: AttemptSave,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WritingAttemptRead:
    return writing_service.save_attempt(
        db, current_user.id, attempt_id, payload.version, payload.draft_text
    )


@router.post("/attempts/{attempt_id}/grade", response_model=WritingAttemptRead)
def grade_attempt(
    attempt_id: int,
    payload: AttemptGrade,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WritingAttemptRead:
    attempt = WritingRepository(db).get_attempt(attempt_id, current_user.id)
    # Bài đã chấm chỉ đọc lại kết quả, không tiêu thụ provider hoặc thêm lượt thử.
    if attempt is None or attempt.status == "graded":
        return writing_service.grade_attempt(db, current_user.id, attempt_id, payload.version, is_admin=current_user.is_superuser)
    format_name = attempt.prompt_snapshot.get("format")
    feature = {"sentence": "sentence_feedback", "vocabulary_translation": "vocabulary_paragraph_feedback"}.get(format_name, "writing_feedback")
    with provider_trial(db, request, feature, current_user):
        return writing_service.grade_attempt(db, current_user.id, attempt_id, payload.version, is_admin=current_user.is_superuser)


@router.get("/attempts", response_model=WritingAttemptList)
def attempt_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 20,
    prompt_id: Annotated[int | None, Query(gt=0)] = None,
    attempt_status: Annotated[Literal["draft", "grading", "graded", "failed"] | None, Query(alias="status")] = None,
) -> WritingAttemptList:
    return writing_service.list_attempts(
        db, current_user.id, page, page_size, prompt_id, attempt_status
    )


@router.get("/attempts/{attempt_id}", response_model=WritingAttemptRead)
def read_attempt(
    attempt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WritingAttemptRead:
    return writing_service.read_owned_attempt(db, current_user.id, attempt_id)


@router.get("/error-history", response_model=WritingErrorHistory)
def error_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 20,
) -> WritingErrorHistory:
    return writing_service.list_error_history(db, current_user.id, page, page_size)


@router.get("/usage", response_model=WritingUsageRead)
def usage(
    request: Request,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db),
    feature: Literal["writing_feedback", "sentence_feedback", "vocabulary_paragraph_feedback"] = "writing_feedback",
) -> WritingUsageRead:
    usage = writing_service.get_usage(db, current_user.id, is_admin=current_user.is_superuser)
    if current_user.is_superuser:
        return usage
    used = int(account_trial_used(db, current_user, feature, request))
    return WritingUsageRead(usage_date=usage.usage_date, daily_limit=1, used=used, remaining=1 - used)
