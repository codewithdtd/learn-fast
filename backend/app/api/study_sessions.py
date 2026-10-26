import hmac

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.api.sheets import ensure_sheet_visible, get_sheet_or_404
from app.core.database import get_db
from app.models import StudySession, User
from app.schemas.sheet import SheetDetail
from app.schemas.srs import StudySessionRatingRequest, StudySessionRatingResponse
from app.schemas.study_session import (
    StudySessionAnswer,
    StudySessionAnswerResponse,
    StudySessionCreate,
    StudySessionDetail,
    StudySessionRoundCreate,
)
from app.services.guest_ai_quota import guest_key_hash_from_request
from app.services.study_session import (
    StudySessionConflictError,
    StudySessionPayloadError,
    answer_round_card,
    complete_study_round,
    complete_study_session,
    create_next_study_round,
    create_study_session,
    get_study_session_or_404,
    record_study_answer,
)
from app.services.srs import (
    SrsConflictError,
    SrsPayloadError,
    SrsPersistenceError,
    rate_completed_session,
)


router = APIRouter(tags=["study sessions"])


def get_accessible_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> StudySession:
    session = get_study_session_or_404(db, session_id)
    if current_user is not None and current_user.is_superuser:
        return session
    if current_user is not None:
        if session.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session not found.")
        return session

    # Guest study rows have no account owner; the browser's private token is stored only as a one-way hash.
    guest_hash = guest_key_hash_from_request(request)
    if session.user_id is not None or not session.guest_key_hash or not hmac.compare_digest(session.guest_key_hash, guest_hash):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session not found.")
    return session


@router.post("/study-sessions", response_model=StudySessionDetail, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: StudySessionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> StudySessionDetail:
    sheet = get_sheet_or_404(db, payload.sheet_id)
    ensure_sheet_visible(db, sheet, current_user)
    guest_hash = guest_key_hash_from_request(request) if current_user is None else None
    try:
        return create_study_session(
            db,
            payload,
            user_id=current_user.id if current_user else None,
            guest_key_hash=guest_hash,
        )
    except StudySessionPayloadError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from error
    except StudySessionConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get("/study-sessions/{session_id}", response_model=StudySessionDetail)
def get_session(session: StudySession = Depends(get_accessible_session)) -> StudySessionDetail:
    return StudySessionDetail.model_validate(session)


@router.post("/study-sessions/{session_id}/cards/{card_id}/answer", response_model=StudySessionAnswerResponse)
def answer_session_card(
    session_id: int,
    card_id: int,
    payload: StudySessionAnswer,
    db: Session = Depends(get_db),
    _session: StudySession = Depends(get_accessible_session),
) -> StudySessionAnswerResponse:
    try:
        return record_study_answer(db, session_id, card_id, payload)
    except StudySessionPayloadError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from error
    except StudySessionConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.put("/study-sessions/{session_id}/rounds/{round_id}/cards/{card_id}/answer", response_model=StudySessionDetail)
def answer_round_session_card(
    session_id: int,
    round_id: int,
    card_id: int,
    payload: StudySessionAnswer,
    db: Session = Depends(get_db),
    _session: StudySession = Depends(get_accessible_session),
) -> StudySessionDetail:
    try:
        return answer_round_card(db, session_id, round_id, card_id, payload)
    except StudySessionPayloadError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from error
    except StudySessionConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.post("/study-sessions/{session_id}/rounds/{round_id}/complete", response_model=StudySessionDetail)
def complete_round(
    session_id: int,
    round_id: int,
    db: Session = Depends(get_db),
    _session: StudySession = Depends(get_accessible_session),
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
    _session: StudySession = Depends(get_accessible_session),
) -> StudySessionDetail:
    try:
        return create_next_study_round(db, session_id, payload.scope)
    except StudySessionPayloadError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from error
    except StudySessionConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.post("/study-sessions/{session_id}/complete", response_model=StudySessionDetail)
def complete_session(
    session_id: int,
    db: Session = Depends(get_db),
    _session: StudySession = Depends(get_accessible_session),
) -> StudySessionDetail:
    try:
        return complete_study_session(db, session_id)
    except StudySessionPayloadError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from error
    except StudySessionConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.post("/study-sessions/{session_id}/rating", response_model=StudySessionRatingResponse)
def rate_session(
    session_id: int,
    payload: StudySessionRatingRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
    _session: StudySession = Depends(get_accessible_session),
) -> StudySessionRatingResponse:
    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to save your review progress.")
    if _session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only your own study session can update the review schedule.")
    if not current_user.is_superuser:
        sheet_owner = get_sheet_or_404(db, _session.sheet_id).workbook.user_id
        if sheet_owner != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Review progress is available only for your personal sheets.")
    try:
        session, sheet = rate_completed_session(db, session_id, payload.rating)
    except SrsPayloadError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from error
    except SrsConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except SrsPersistenceError as error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Sheet review schedule could not be saved. Please try again.") from error
    return StudySessionRatingResponse(session=StudySessionDetail.model_validate(session), sheet=SheetDetail.model_validate(sheet))
