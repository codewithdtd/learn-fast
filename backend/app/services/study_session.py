import hashlib
import logging
import random
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Flashcard,
    SheetStatus,
    StudyDirection,
    StudyRoundCardResult,
    StudyRoundScope,
    StudyRoundStatus,
    StudySession,
    StudySessionCard,
    StudySessionRound,
    StudySessionRoundCard,
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


def _session_load_options():
    return (
        selectinload(StudySession.session_cards).selectinload(StudySessionCard.flashcard),
        selectinload(StudySession.rounds)
        .selectinload(StudySessionRound.round_cards)
        .selectinload(StudySessionRoundCard.session_card)
        .selectinload(StudySessionCard.flashcard),
    )


def get_study_session_or_404(db: Session, session_id: int) -> StudySession:
    session = db.scalar(
        select(StudySession).where(StudySession.id == session_id).options(*_session_load_options())
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session not found.")
    return session


def _stable_shuffle(session: StudySession, round_number: int, scope: StudyRoundScope, cards: list[StudySessionCard]) -> list[StudySessionCard]:
    """Return a repeatable order before persisting it as immutable queue positions."""
    # The server, not the browser, owns the queue. Deriving a PRNG seed from
    # immutable identifiers makes retries deterministic while persisted
    # positions guarantee refreshes and future code changes keep this exact order.
    seed_text = f"{session.id}:{round_number}:{scope.value}"
    seed = int.from_bytes(hashlib.sha256(seed_text.encode("utf-8")).digest()[:8], "big")
    shuffled = list(cards)
    random.Random(seed).shuffle(shuffled)
    return shuffled


def _create_round(
    db: Session,
    session: StudySession,
    *,
    scope: StudyRoundScope,
    cards: list[StudySessionCard],
    source_round: StudySessionRound | None,
) -> StudySessionRound:
    round_number = len(session.rounds) + 1
    study_round = StudySessionRound(
        session=session,
        source_round=source_round,
        round_number=round_number,
        scope=scope,
        total_cards=len(cards),
    )
    db.add(study_round)
    db.flush()
    for position, session_card in enumerate(
        _stable_shuffle(session, round_number, scope, cards), start=1
    ):
        study_round.round_cards.append(
            StudySessionRoundCard(session_card=session_card, position=position)
        )
    return study_round


def create_study_session(db: Session, payload: StudySessionCreate) -> StudySessionDetail:
    sheet = db.get(StudySheet, payload.sheet_id)
    if sheet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study sheet not found.")
    if payload.session_type is StudySessionType.SRS_REVIEW and sheet.status is not SheetStatus.DUE:
        raise StudySessionPayloadError("Only a due study sheet can start an SRS review.")

    card_query = select(Flashcard).where(Flashcard.sheet_id == sheet.id)
    if payload.session_type is StudySessionType.WEAK_CARDS:
        card_query = card_query.where(Flashcard.is_weak.is_(True))
    cards = db.scalars(card_query.order_by(Flashcard.position)).all()
    if not cards:
        source = "Weak cards" if payload.session_type is StudySessionType.WEAK_CARDS else "Flashcards"
        raise StudySessionPayloadError(f"{source} are not available for this study session.")

    fixed_direction = payload.direction if payload.direction is not StudyDirection.MIXED else None
    session = StudySession(
        sheet_id=sheet.id,
        session_type=payload.session_type,
        direction=payload.direction,
        total_cards=len(cards),
        session_cards=[StudySessionCard(flashcard=card, direction=fixed_direction) for card in cards],
    )
    db.add(session)
    try:
        db.flush()
        _create_round(
            db,
            session,
            scope=StudyRoundScope.ALL,
            cards=list(session.session_cards),
            source_round=None,
        )
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Study session creation failed after database rollback.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Study session could not be created. Please try again.",
        ) from error
    return StudySessionDetail.model_validate(get_study_session_or_404(db, session.id))


def _validate_answer_direction(
    session: StudySession, session_card: StudySessionCard, payload: StudySessionAnswer
) -> StudyDirection:
    answer_direction = StudyDirection(payload.direction.value)
    if session.direction is not StudyDirection.MIXED:
        if answer_direction is not session.direction:
            raise StudySessionPayloadError("Answer direction must match the study session direction.")
    elif session_card.direction is None:
        session_card.direction = answer_direction
    elif answer_direction is not session_card.direction:
        raise StudySessionPayloadError("Answer direction must match this flashcard's first direction.")
    return answer_direction


def answer_round_card(
    db: Session,
    session_id: int,
    round_id: int,
    card_id: int,
    payload: StudySessionAnswer,
) -> StudySessionDetail:
    session = get_study_session_or_404(db, session_id)
    if session.status is not StudySessionStatus.ACTIVE:
        raise StudySessionConflictError("Study session is no longer active.")
    study_round = next((item for item in session.rounds if item.id == round_id), None)
    if study_round is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session round not found.")
    if study_round.status is not StudyRoundStatus.ACTIVE:
        raise StudySessionConflictError("Completed rounds are read-only.")
    if session.active_round is not study_round:
        raise StudySessionConflictError("Only the active round can be answered.")
    round_card = next(
        (item for item in study_round.round_cards if item.session_card.flashcard_id == card_id), None
    )
    if round_card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session card not found in this round.")
    answer_direction = _validate_answer_direction(session, round_card.session_card, payload)
    answer_result = StudyRoundCardResult(payload.result.value)
    if round_card.result is not answer_result:
        # A round is deliberately editable until it is locked. Replacing this
        # single persisted answer never changes confirmed counters, preventing
        # accidental clicks from manufacturing extra attempts or lapses.
        round_card.result = answer_result
        round_card.answered_at = datetime.now(timezone.utc)
    if all(item.result is not None for item in study_round.round_cards):
        _lock_study_round(session, study_round)
        _complete_session_if_mastered(session)
    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Study round answer update failed after database rollback.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Study answer could not be recorded. Please try again.",
        ) from error
    refreshed = get_study_session_or_404(db, session.id)
    # `answer_direction` is intentionally validated before the idempotency
    # branch, so a mixed-direction retry cannot silently change card history.
    del answer_direction
    return StudySessionDetail.model_validate(refreshed)


def _recalculate_confirmed_metrics(session: StudySession) -> None:
    completed_rounds = [item for item in session.rounds if item.status is StudyRoundStatus.COMPLETED]
    total_attempts = 0
    again_count = 0
    first_try_correct = 0
    for session_card in session.session_cards:
        card_history = [
            round_card
            for study_round in completed_rounds
            for round_card in study_round.round_cards
            if round_card.session_card_id == session_card.id
        ]
        card_history.sort(key=lambda item: item.round.round_number)
        session_card.attempt_count = len(card_history)
        session_card.again_count = sum(item.result is StudyRoundCardResult.AGAIN for item in card_history)
        session_card.remembered = bool(card_history and card_history[-1].result is StudyRoundCardResult.REMEMBERED)
        session_card.first_try_correct = bool(
            card_history and card_history[0].result is StudyRoundCardResult.REMEMBERED
        )
        session_card.last_answered_at = card_history[-1].answered_at if card_history else None
        total_attempts += session_card.attempt_count
        again_count += session_card.again_count
        first_try_correct += int(session_card.first_try_correct)
    session.total_attempts = total_attempts
    session.again_count = again_count
    session.first_try_correct = first_try_correct


def _lock_study_round(session: StudySession, study_round: StudySessionRound) -> None:
    """Freeze a fully answered round and materialize its confirmed metrics."""
    study_round.remembered_count = sum(
        item.result is StudyRoundCardResult.REMEMBERED for item in study_round.round_cards
    )
    study_round.again_count = study_round.total_cards - study_round.remembered_count
    study_round.recall_percentage = round(
        (study_round.remembered_count / study_round.total_cards) * 100, 2
    )
    study_round.status = StudyRoundStatus.COMPLETED
    study_round.completed_at = datetime.now(timezone.utc)
    _recalculate_confirmed_metrics(session)


def _complete_session_if_mastered(session: StudySession) -> bool:
    """Complete only when the just-locked queue proves all cards are remembered."""
    completed_rounds = [item for item in session.rounds if item.status is StudyRoundStatus.COMPLETED]
    if (
        session.active_round is not None
        or not completed_rounds
        or any(not item.remembered for item in session.session_cards)
        or completed_rounds[-1].recall_percentage != 100
    ):
        return False
    session.status = StudySessionStatus.COMPLETED
    session.completed_at = datetime.now(timezone.utc)
    # Rounds have unequal numbers of cards, but each is one learning pass. An
    # unweighted mean therefore reflects recall across passes, as agreed.
    session.mastery_score = round(
        sum(item.recall_percentage or 0 for item in completed_rounds) / len(completed_rounds), 2
    )
    return True


def complete_study_round(db: Session, session_id: int, round_id: int) -> StudySessionDetail:
    session = get_study_session_or_404(db, session_id)
    if session.status is not StudySessionStatus.ACTIVE:
        raise StudySessionConflictError("Study session is no longer active.")
    study_round = next((item for item in session.rounds if item.id == round_id), None)
    if study_round is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session round not found.")
    if study_round.status is StudyRoundStatus.COMPLETED:
        return StudySessionDetail.model_validate(session)
    if session.active_round is not study_round:
        raise StudySessionConflictError("Only the active round can be completed.")
    unanswered = sum(item.result is None for item in study_round.round_cards)
    if unanswered:
        raise StudySessionPayloadError(f"Study round still has {unanswered} unanswered card(s).")
    _lock_study_round(session, study_round)
    _complete_session_if_mastered(session)
    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Study round completion failed after database rollback.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Study round could not be completed. Please try again.",
        ) from error
    return StudySessionDetail.model_validate(get_study_session_or_404(db, session.id))


def create_next_study_round(
    db: Session, session_id: int, scope: StudyRoundScope
) -> StudySessionDetail:
    session = get_study_session_or_404(db, session_id)
    if session.status is not StudySessionStatus.ACTIVE:
        raise StudySessionConflictError("Only an active study session can start another round.")
    active_round = session.active_round
    completed_rounds = [item for item in session.rounds if item.status is StudyRoundStatus.COMPLETED]
    if not completed_rounds:
        raise StudySessionPayloadError("Complete the first round before starting another round.")
    latest_round = completed_rounds[-1]
    if active_round is not None:
        # A browser retry after a successful POST receives the same active
        # round instead of creating a duplicate queue. A different requested
        # follow-up remains a conflict because the user must finish/choose it.
        if active_round.source_round_id == latest_round.id and active_round.scope is scope:
            return StudySessionDetail.model_validate(session)
        raise StudySessionConflictError("An active round already exists.")
    if scope is StudyRoundScope.ALL:
        cards = list(session.session_cards)
    else:
        forgotten_ids = {
            item.session_card_id
            for item in latest_round.round_cards
            if item.result is StudyRoundCardResult.AGAIN
        }
        cards = [item for item in session.session_cards if item.id in forgotten_ids]
        if not cards:
            raise StudySessionPayloadError("The latest round has no forgotten cards to study.")
    try:
        _create_round(db, session, scope=scope, cards=cards, source_round=latest_round)
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Study round creation failed after database rollback.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Study round could not be started. Please try again.",
        ) from error
    return StudySessionDetail.model_validate(get_study_session_or_404(db, session.id))


def record_study_answer(
    db: Session, session_id: int, card_id: int, payload: StudySessionAnswer
) -> StudySessionAnswerResponse:
    """Compatibility endpoint for clients from before persisted rounds existed."""
    session = get_study_session_or_404(db, session_id)
    if session.active_round is None:
        raise StudySessionConflictError("There is no active study round.")
    updated = answer_round_card(db, session_id, session.active_round.id, card_id, payload)
    active_round = updated.active_round
    updated_card = next(item for item in updated.session_cards if item.flashcard_id == card_id)
    return StudySessionAnswerResponse(
        session_id=updated.id,
        card_id=card_id,
        direction=payload.direction,
        result=payload.result,
        attempt_count=updated_card.attempt_count,
        again_count=updated_card.again_count,
        remembered=updated_card.remembered,
        first_try_correct=updated_card.first_try_correct,
        total_attempts=updated.total_attempts,
        session_again_count=updated.again_count,
        session_first_try_correct=updated.first_try_correct,
        remaining_cards=sum(item.result is None for item in active_round.round_cards) if active_round else 0,
    )


def complete_study_session(db: Session, session_id: int) -> StudySessionDetail:
    session = get_study_session_or_404(db, session_id)
    if session.status is StudySessionStatus.COMPLETED:
        return StudySessionDetail.model_validate(session)
    if session.status is not StudySessionStatus.ACTIVE:
        raise StudySessionConflictError("Only an active study session can be completed.")
    if session.active_round is not None:
        raise StudySessionPayloadError("Complete the active round before finishing the session.")
    completed_rounds = [item for item in session.rounds if item.status is StudyRoundStatus.COMPLETED]
    if not completed_rounds:
        raise StudySessionPayloadError("Study session has no completed rounds.")
    if any(not item.remembered for item in session.session_cards):
        raise StudySessionPayloadError("Study session must reach 100% remembered before it can finish.")
    if completed_rounds[-1].recall_percentage != 100:
        raise StudySessionPayloadError("The latest round must reach 100% before the session can finish.")
    _complete_session_if_mastered(session)
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
