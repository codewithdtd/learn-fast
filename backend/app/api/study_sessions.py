from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.study_session import (
    StudySessionAnswer,
    StudySessionAnswerResponse,
    StudySessionCreate,
    StudySessionDetail,
    StudySessionRoundCreate,
)
from app.schemas.srs import StudySessionRatingRequest, StudySessionRatingResponse
from app.schemas.sheet import SheetDetail
from app.services.study_session import (
    StudySessionConflictError,
    StudySessionPayloadError,
    complete_study_session,
    complete_study_round,
    create_next_study_round,
    create_study_session,
    get_study_session_or_404,
    answer_round_card,
    record_study_answer,
)
from app.services.srs import (
    SrsConflictError,
    SrsPayloadError,
    SrsPersistenceError,
    rate_completed_session,
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
    except StudySessionConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
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


@router.put(
    "/study-sessions/{session_id}/rounds/{round_id}/cards/{card_id}/answer",
    response_model=StudySessionDetail,
)
def answer_round_session_card(
    session_id: int,
    round_id: int,
    card_id: int,
    payload: StudySessionAnswer,
    db: Session = Depends(get_db),
) -> StudySessionDetail:
    try:
        return answer_round_card(db, session_id, round_id, card_id, payload)
    except StudySessionPayloadError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from error
    except StudySessionConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.post(
    "/study-sessions/{session_id}/rounds/{round_id}/complete",
    response_model=StudySessionDetail,
)
def complete_round(
    session_id: int,
    round_id: int,
    db: Session = Depends(get_db),
) -> StudySessionDetail:
    try:
        return complete_study_round(db, session_id, round_id)
    except StudySessionPayloadError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from error
    except StudySessionConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.post("/study-sessions/{session_id}/rounds", response_model=StudySessionDetail)
def create_round(
    session_id: int,
    payload: StudySessionRoundCreate,
    db: Session = Depends(get_db),
) -> StudySessionDetail:
    try:
        return create_next_study_round(db, session_id, payload.scope)
    except StudySessionPayloadError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from error
    except StudySessionConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
@router.post(
    "/study-sessions/{session_id}/complete",
    response_model=StudySessionDetail,
)
def complete_session(
    session_id: int,
    db: Session = Depends(get_db),
) -> StudySessionDetail:
    try:
        return complete_study_session(db, session_id)
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


@router.post(
    "/study-sessions/{session_id}/rating",
    response_model=StudySessionRatingResponse,
)
def rate_session(
    session_id: int,
    payload: StudySessionRatingRequest,
    db: Session = Depends(get_db),
) -> StudySessionRatingResponse:
    try:
        session, sheet = rate_completed_session(db, session_id, payload.rating)
    except SrsPayloadError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        ) from error
    except SrsConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    except SrsPersistenceError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Sheet review schedule could not be saved. Please try again.",
        ) from error

    return StudySessionRatingResponse(
        session=StudySessionDetail.model_validate(session),
        sheet=SheetDetail.model_validate(sheet),
    )
