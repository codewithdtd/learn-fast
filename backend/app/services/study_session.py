import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Flashcard,
    StudyDirection,
    StudySession,
    StudySessionCard,
    StudySessionStatus,
    StudySessionType,
    StudySheet,
)
from app.schemas.study_session import (
    StudyAnswerDirection,
    StudyAnswerResult,
    StudySessionAnswer,
    StudySessionAnswerResponse,
    StudySessionCreate,
    StudySessionDetail,
)


logger = logging.getLogger(__name__)


class StudySessionPayloadError(ValueError):
    """Raised for a valid JSON payload that violates session business rules."""


class StudySessionConflictError(ValueError):
    """Raised when an answer conflicts with the persisted session state."""


def get_study_session_or_404(db: Session, session_id: int) -> StudySession:
    session = db.scalar(
        select(StudySession)
        .where(StudySession.id == session_id)
        .options(
            selectinload(StudySession.session_cards).selectinload(StudySessionCard.flashcard)
        )
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study session not found.",
        )
    return session


def create_study_session(
    db: Session,
    payload: StudySessionCreate,
) -> StudySessionDetail:
    sheet = db.get(StudySheet, payload.sheet_id)
    if sheet is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study sheet not found.",
        )

    card_query = select(Flashcard).where(Flashcard.sheet_id == sheet.id)
    if payload.session_type is StudySessionType.WEAK_CARDS:
        card_query = card_query.where(Flashcard.is_weak.is_(True))
    cards = db.scalars(card_query.order_by(Flashcard.position)).all()
    if not cards:
        source = "Weak cards" if payload.session_type is StudySessionType.WEAK_CARDS else "Flashcards"
        raise StudySessionPayloadError(f"{source} are not available for this study session.")

    session = StudySession(
        sheet_id=sheet.id,
        session_type=payload.session_type,
        direction=payload.direction,
        total_cards=len(cards),
    )
    fixed_direction = (
        payload.direction if payload.direction is not StudyDirection.MIXED else None
    )
    # Enrollment is a session snapshot. Later Day 10 UI can fetch the same
    # cards after reload even if sheet filters change in the browser.
    session.session_cards = [
        StudySessionCard(flashcard=card, direction=fixed_direction) for card in cards
    ]
    db.add(session)

    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Study session creation failed after database rollback.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Study session could not be created. Please try again.",
        ) from error

    return StudySessionDetail.model_validate(get_study_session_or_404(db, session.id))


def record_study_answer(
    db: Session,
    session_id: int,
    card_id: int,
    payload: StudySessionAnswer,
) -> StudySessionAnswerResponse:
    session = get_study_session_or_404(db, session_id)
    if session.status is not StudySessionStatus.ACTIVE:
        raise StudySessionConflictError("Study session is no longer active.")

    session_card = next(
        (item for item in session.session_cards if item.flashcard_id == card_id),
        None,
    )
    if session_card is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study session card not found.",
        )
    if session_card.remembered:
        raise StudySessionConflictError("This flashcard was already remembered in this session.")

    answer_direction = StudyDirection(payload.direction.value)
    if session.direction is not StudyDirection.MIXED:
        if answer_direction is not session.direction:
            raise StudySessionPayloadError("Answer direction must match the study session direction.")
    elif session_card.direction is None:
        # Mixed is a session configuration, not a concrete answer direction.
        # Persist the first real direction so retries cannot switch a card's
        # history between EN→VI and VI→EN inside one session.
        session_card.direction = answer_direction
    elif answer_direction is not session_card.direction:
        raise StudySessionPayloadError("Answer direction must match this flashcard's first direction.")

    was_first_attempt = session_card.attempt_count == 0
    answered_at = datetime.now(timezone.utc)
    session_card.attempt_count += 1
    session_card.last_answered_at = answered_at
    session.total_attempts += 1

    if payload.result is StudyAnswerResult.AGAIN:
        session_card.again_count += 1
        session.again_count += 1
    else:
        session_card.remembered = True
        if was_first_attempt:
            session_card.first_try_correct = True
            session.first_try_correct += 1

    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Study answer update failed after database rollback.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Study answer could not be recorded. Please try again.",
        ) from error

    return StudySessionAnswerResponse(
        session_id=session.id,
        card_id=session_card.flashcard_id,
        direction=StudyAnswerDirection(answer_direction.value),
        result=payload.result,
        attempt_count=session_card.attempt_count,
        again_count=session_card.again_count,
        remembered=session_card.remembered,
        first_try_correct=session_card.first_try_correct,
        total_attempts=session.total_attempts,
        session_again_count=session.again_count,
        session_first_try_correct=session.first_try_correct,
        remaining_cards=sum(not item.remembered for item in session.session_cards),
    )


def complete_study_session(db: Session, session_id: int) -> StudySessionDetail:
    session = get_study_session_or_404(db, session_id)
    if session.status is StudySessionStatus.COMPLETED:
        # Completion is idempotent: a browser can retry after a timeout without
        # changing the persisted timestamp, score, or study counters.
        return StudySessionDetail.model_validate(session)
    if session.status is not StudySessionStatus.ACTIVE:
        raise StudySessionConflictError("Only an active study session can be completed.")

    remaining_cards = sum(not item.remembered for item in session.session_cards)
    if remaining_cards:
        raise StudySessionPayloadError(
            f"Study session still has {remaining_cards} card(s) to remember."
        )
    if session.total_cards <= 0:
        raise StudySessionPayloadError("Study session has no cards to complete.")

    session.status = StudySessionStatus.COMPLETED
    session.completed_at = datetime.now(timezone.utc)
    # first_try_correct is updated atomically by answer events. Use that
    # persisted value instead of browser state so score survives refreshes.
    session.mastery_score = round((session.first_try_correct / session.total_cards) * 100, 2)

    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Study session completion failed after database rollback.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Study session could not be completed. Please try again.",
        ) from error

    return StudySessionDetail.model_validate(get_study_session_or_404(db, session.id))
