from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.quick_recall import (
    QuickRecallCompletionRequest,
    QuickRecallCompletionResponse,
)
from app.services.quick_recall import QuickRecallPayloadError, complete_quick_recall


router = APIRouter(tags=["quick recall"])


@router.post(
    "/sheets/{sheet_id}/quick-recall/complete",
    response_model=QuickRecallCompletionResponse,
)
def complete_sheet_quick_recall(
    sheet_id: int,
    payload: QuickRecallCompletionRequest,
    db: Session = Depends(get_db),
) -> QuickRecallCompletionResponse:
    try:
        return complete_quick_recall(db, sheet_id, payload.results)
    except QuickRecallPayloadError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        ) from error
