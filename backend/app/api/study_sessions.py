from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.study_session import (
    StudySessionAnswer,
    StudySessionAnswerResponse,
    StudySessionCreate,
    StudySessionDetail,
)
from app.services.study_session import (
    StudySessionConflictError,
    StudySessionPayloadError,
    create_study_session,
    get_study_session_or_404,
    record_study_answer,
)


router = APIRouter(tags=["study sessions"])


@router.post(
    "/study-sessions",
    response_model=StudySessionDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_session(
    payload: StudySessionCreate,
    db: Session = Depends(get_db),
) -> StudySessionDetail:
    try:
        return create_study_session(db, payload)
    except StudySessionPayloadError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        ) from error


@router.get("/study-sessions/{session_id}", response_model=StudySessionDetail)
def get_session(session_id: int, db: Session = Depends(get_db)) -> StudySessionDetail:
    return StudySessionDetail.model_validate(get_study_session_or_404(db, session_id))


@router.post(
    "/study-sessions/{session_id}/cards/{card_id}/answer",
    response_model=StudySessionAnswerResponse,
)
def answer_session_card(
    session_id: int,
    card_id: int,
    payload: StudySessionAnswer,
    db: Session = Depends(get_db),
) -> StudySessionAnswerResponse:
    try:
        return record_study_answer(db, session_id, card_id, payload)
    except StudySessionPayloadError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        ) from error
    except StudySessionConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
