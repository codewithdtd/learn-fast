import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import Flashcard, StudySheet
from app.schemas.quick_recall import (
    QuickRecallCardResultInput,
    QuickRecallCompletionResponse,
    QuickRecallResult,
)


logger = logging.getLogger(__name__)


class QuickRecallPayloadError(ValueError):
    """Raised when a completion payload does not represent the current sheet."""


def complete_quick_recall(
    db: Session,
    sheet_id: int,
    results: list[QuickRecallCardResultInput],
) -> QuickRecallCompletionResponse:
    sheet = db.get(StudySheet, sheet_id)
    if sheet is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study sheet not found.",
        )

    cards = db.scalars(
        select(Flashcard)
        .where(Flashcard.sheet_id == sheet_id)
        .order_by(Flashcard.position)
    ).all()
    results_by_card_id = {result.flashcard_id: result.result for result in results}
    current_card_ids = {card.id for card in cards}

    # A completion represents the whole sheet. Validating the complete ID set
    # before changing any model prevents partial counters when the client has a
    # stale filter, a missing card, or a card from another sheet.
    if set(results_by_card_id) != current_card_ids:
        raise QuickRecallPayloadError(
            "Quick Recall results must include every flashcard in this sheet exactly once."
        )

    completed_at = datetime.now(timezone.utc)
    remembered_count = 0
    need_review_count = 0

    for card in cards:
        result = results_by_card_id[card.id]
        card.last_result = result.value
        card.last_reviewed_at = completed_at

        if result is QuickRecallResult.REMEMBERED:
            card.correct_count += 1
            remembered_count += 1
        else:
            card.incorrect_count += 1
            # A correct recall does not clear a previous Weak flag: one answer
            # is insufficient evidence that a card is no longer weak.
            card.is_weak = True
            need_review_count += 1

    try:
        # Every card receives the same completion timestamp because they belong
        # to one completed Quick Recall pass, not independent API events.
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Quick Recall completion failed after database rollback.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Quick Recall could not be completed. Please try again.",
        ) from error

    total_cards = len(cards)
    return QuickRecallCompletionResponse(
        sheet_id=sheet.id,
        total_cards=total_cards,
        remembered_count=remembered_count,
        need_review_count=need_review_count,
        recall_percentage=round(remembered_count / total_cards * 100, 2),
        completed_at=completed_at,
    )
