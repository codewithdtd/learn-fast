import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin, get_current_user_optional
from app.core.database import get_db
from app.models.user import User
from app.schemas.ai import (
    AIGenerateRequest,
    AIGeneratedSheetResponse,
    AIMineRequest,
    AISaveSheetRequest,
    AISaveSheetResponse,
)
from app.services.ai_client import extract_chunks_from_text, generate_ai_cards
from app.services.ai_sheet_service import get_exclusion_phrases, save_ai_generated_sheet
from app.services.guest_ai_quota import provider_trial

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post(
    "/generate",
    response_model=AIGeneratedSheetResponse,
    summary="Sinh danh sách Flashcard tự động từ Local AI",
)
def generate_cards_endpoint(
    request: AIGenerateRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> AIGeneratedSheetResponse:
    """Gọi Local AI để sinh các cụm từ giao tiếp/công sở thực tế, loại trừ các từ đã tồn tại nếu có."""
    # Unprivileged previews receive stateless output and cannot read or change saved library content.
    if current_user is None or not current_user.is_superuser:
        if request.target_sheet_id is not None or request.target_workbook_id is not None:
            raise HTTPException(status_code=400, detail="Guest previews cannot target a saved workbook or sheet.")
        exclusion_phrases: set[str] = set()
    else:
        exclusion_phrases = get_exclusion_phrases(
            db=db,
            user=current_user,
            sheet_id=request.target_sheet_id,
            workbook_id=request.target_workbook_id,
        )
    with provider_trial(db, http_request, "flashcard_generation", current_user):
        return generate_ai_cards(
            topic=request.topic,
            total_count=request.count,
            level=request.level,
            existing_phrases=exclusion_phrases,
        )


@router.post(
    "/mine",
    response_model=AIGeneratedSheetResponse,
    summary="Bóc tách chunks từ câu văn/báo chí bằng Local AI",
)
def mine_chunks_endpoint(
    request: AIMineRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> AIGeneratedSheetResponse:
    """Phân tích đoạn văn bản, bóc tách các collocations/chunks và giữ nguyên câu văn ngữ cảnh gốc."""
    # Share this quota across both AI routes so changing endpoints cannot bypass the guest trial.
    if current_user is None or not current_user.is_superuser:
        if request.target_sheet_id is not None or request.target_workbook_id is not None:
            raise HTTPException(status_code=400, detail="Guest previews cannot target a saved workbook or sheet.")
        exclusion_phrases: set[str] = set()
    else:
        exclusion_phrases = get_exclusion_phrases(
            db=db,
            user=current_user,
            sheet_id=request.target_sheet_id,
            workbook_id=request.target_workbook_id,
        )
    with provider_trial(db, http_request, "flashcard_generation", current_user):
        sheet_name, cards = extract_chunks_from_text(
            text=request.text,
            existing_phrases=exclusion_phrases,
        )
    return AIGeneratedSheetResponse(
        sheet_name=sheet_name,
        cards=cards,
        total_generated=len(cards),
    )


@router.post(
    "/save",
    response_model=AISaveSheetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Lưu Study Sheet hoặc nối tiếp thẻ được sinh bởi AI vào cơ sở dữ liệu",
)
def save_sheet_endpoint(
    request: AISaveSheetRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin),
) -> AISaveSheetResponse:
    """Lưu danh sách thẻ đã duyệt vào Workbook mới/cũ hoặc nối tiếp vào Sheet có sẵn."""
    return save_ai_generated_sheet(
        db=db,
        current_user=admin_user,
        payload=request,
    )
