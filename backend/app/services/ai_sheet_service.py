import logging
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.enums import SheetStatus
from app.models.flashcard import Flashcard
from app.models.study_sheet import StudySheet
from app.models.user import User
from app.models.workbook import Workbook
from app.schemas.ai import AISaveSheetRequest, AISaveSheetResponse

logger = logging.getLogger(__name__)


def get_exclusion_phrases(
    db: Session,
    user: User,
    sheet_id: Optional[int] = None,
    workbook_id: Optional[int] = None,
) -> list[str]:
    """Lấy danh sách các cụm từ (phrase) đã có trong Sheet hoặc Workbook để đưa vào prompt chống trùng lặp."""
    if sheet_id:
        sheet_stmt = select(StudySheet).join(Workbook).where(StudySheet.id == sheet_id)
        if not user.is_superuser:
            sheet_stmt = sheet_stmt.where(Workbook.user_id == user.id)
        sheet = db.scalar(sheet_stmt)
        if sheet:
            phrases_stmt = select(Flashcard.phrase).where(Flashcard.sheet_id == sheet_id)
            return list(db.scalars(phrases_stmt).all())

    if workbook_id:
        wb_stmt = select(Workbook).where(Workbook.id == workbook_id)
        if not user.is_superuser:
            wb_stmt = wb_stmt.where(Workbook.user_id == user.id)
        wb = db.scalar(wb_stmt)
        if wb:
            phrases_stmt = (
                select(Flashcard.phrase)
                .join(StudySheet)
                .where(StudySheet.workbook_id == workbook_id)
            )
            return list(db.scalars(phrases_stmt).all())

    return []


def save_ai_generated_sheet(
    db: Session,
    current_user: User,
    payload: AISaveSheetRequest,
) -> AISaveSheetResponse:
    """Lưu danh sách thẻ AI vào database: hoặc tạo Sheet mới hoặc nối tiếp (append) vào Sheet có sẵn.
    
    Toàn bộ quá trình tạo Sheet và các Flashcard được thực thi trong một transaction an toàn.
    """
    if settings.demo_mode:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chế độ Demo Showcase đang bật: Không thể lưu dữ liệu mới vào hệ thống.",
        )

    if not payload.cards:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Danh sách thẻ lưu không được để trống.",
        )

    try:
        # TRƯỜNG HỢP 1: Append thẻ vào Sheet có sẵn
        if payload.mode == "append":
            if not payload.target_sheet_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Thiếu target_sheet_id khi lưu ở chế độ append.",
                )

            sheet_stmt = select(StudySheet).join(Workbook).where(StudySheet.id == payload.target_sheet_id)
            if not current_user.is_superuser:
                sheet_stmt = sheet_stmt.where(Workbook.user_id == current_user.id)
            sheet = db.scalar(sheet_stmt)
            if not sheet:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Không tìm thấy Study Sheet đích hoặc bạn không có quyền truy cập.",
                )

            workbook = sheet.workbook

            current_max_pos = db.scalar(
                select(func.coalesce(func.max(Flashcard.position), 0)).where(
                    Flashcard.sheet_id == sheet.id
                )
            ) or 0

            new_flashcards = [
                Flashcard(
                    sheet_id=sheet.id,
                    position=current_max_pos + idx + 1,
                    phrase=card.phrase,
                    meaning=card.meaning,
                    example_en=card.example_en,
                    example_vi=card.example_vi,
                )
                for idx, card in enumerate(payload.cards)
            ]

            db.add_all(new_flashcards)
            sheet.card_count += len(payload.cards)
            sheet.is_ai_generated = True
            workbook.total_cards += len(payload.cards)

            db.commit()
            db.refresh(sheet)
            db.refresh(workbook)

            return AISaveSheetResponse(
                workbook_id=workbook.id,
                workbook_name=workbook.name,
                sheet_id=sheet.id,
                sheet_name=sheet.name,
                cards_added=len(payload.cards),
                total_cards=sheet.card_count,
                is_appended=True,
            )

        # TRƯỜNG HỢP 2: Tạo Sheet mới
        if payload.workbook_id:
            wb_stmt = select(Workbook).where(Workbook.id == payload.workbook_id)
            if not current_user.is_superuser:
                wb_stmt = wb_stmt.where(Workbook.user_id == current_user.id)
            workbook = db.scalar(wb_stmt)
            if not workbook:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Không tìm thấy Workbook được chọn hoặc bạn không có quyền truy cập.",
                )
        else:
            new_wb_name = payload.new_workbook_name or "AI Vocabulary Collection"
            workbook = Workbook(
                user_id=current_user.id,
                name=new_wb_name,
                original_filename="AI_Generated.xlsx",
                sheet_count=0,
                total_cards=0,
            )
            db.add(workbook)
            db.flush()

        current_max_sheet_pos = db.scalar(
            select(func.coalesce(func.max(StudySheet.position), 0)).where(
                StudySheet.workbook_id == workbook.id
            )
        ) or 0

        new_sheet = StudySheet(
            workbook_id=workbook.id,
            name=payload.sheet_name,
            position=current_max_sheet_pos + 1,
            card_count=len(payload.cards),
            status=SheetStatus.NOT_STARTED,
            is_ai_generated=True,
        )
        db.add(new_sheet)
        db.flush()

        flashcards = [
            Flashcard(
                sheet_id=new_sheet.id,
                position=idx + 1,
                phrase=card.phrase,
                meaning=card.meaning,
                example_en=card.example_en,
                example_vi=card.example_vi,
            )
            for idx, card in enumerate(payload.cards)
        ]
        db.add_all(flashcards)

        workbook.sheet_count += 1
        workbook.total_cards += len(payload.cards)

        db.commit()
        db.refresh(new_sheet)
        db.refresh(workbook)

        return AISaveSheetResponse(
            workbook_id=workbook.id,
            workbook_name=workbook.name,
            sheet_id=new_sheet.id,
            sheet_name=new_sheet.name,
            cards_added=len(payload.cards),
            total_cards=new_sheet.card_count,
            is_appended=False,
        )

    except HTTPException:
        db.rollback()
        raise
    except Exception as err:
        db.rollback()
        logger.error(f"Error saving AI generated sheet: {err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi lưu Study Sheet vào cơ sở dữ liệu: {str(err)}",
        )
