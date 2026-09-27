import logging
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post(
    "/generate",
    response_model=AIGeneratedSheetResponse,
    summary="Sinh danh sách Flashcard tự động từ Local AI",
)
def generate_cards_endpoint(
    request: AIGenerateRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin),
) -> AIGeneratedSheetResponse:
    """Gọi Local AI để sinh các cụm từ giao tiếp/công sở thực tế, loại trừ các từ đã tồn tại nếu có."""
    exclusion_phrases = get_exclusion_phrases(
        db=db,
        user=admin_user,
        sheet_id=request.target_sheet_id,
        workbook_id=request.target_workbook_id,
    )
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
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin),
) -> AIGeneratedSheetResponse:
    """Phân tích đoạn văn bản, bóc tách các collocations/chunks và giữ nguyên câu văn ngữ cảnh gốc."""
    exclusion_phrases = get_exclusion_phrases(
        db=db,
        user=admin_user,
        sheet_id=request.target_sheet_id,
        workbook_id=request.target_workbook_id,
    )
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
