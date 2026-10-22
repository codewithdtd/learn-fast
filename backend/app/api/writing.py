from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin, get_current_user
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
)
from app.services import writing as writing_service
from app.services.sentence_practice import create_sentence_attempt
from app.schemas.sentence_practice import SentenceAttemptCreate


# Bảo vệ toàn router để route đọc dữ liệu và route mới cũng luôn yêu cầu quyền admin.
router = APIRouter(prefix="/writing", tags=["writing"], dependencies=[Depends(get_current_admin)])


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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WritingAttemptRead:
    return create_sentence_attempt(db, current_user.id, payload.flashcard_id)


@router.post(
    "/attempts/random",
    response_model=WritingAttemptRead,
    status_code=status.HTTP_201_CREATED,
)
def generate_random_attempt(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WritingAttemptRead:
    return writing_service.generate_random_attempt(db, current_user.id)


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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WritingAttemptRead:
    return writing_service.grade_attempt(db, current_user.id, attempt_id, payload.version)


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


@router.get("/usage", response_model=WritingUsageRead)
def usage(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> WritingUsageRead:
    return writing_service.get_usage(db, current_user.id)
