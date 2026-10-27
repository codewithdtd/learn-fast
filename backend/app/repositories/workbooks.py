from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Flashcard, StudySheet, Workbook


def get_workbook(db: Session, workbook_id: int) -> Workbook | None:
    return db.get(Workbook, workbook_id)


def lock_workbook_for_sheet_management(db: Session, workbook_id: int) -> Workbook | None:
    # Khóa workbook để hai yêu cầu tạo sheet đồng thời không cấp cùng một vị trí.
    return db.scalar(select(Workbook).where(Workbook.id == workbook_id).with_for_update())


def get_sheet(db: Session, sheet_id: int) -> StudySheet | None:
    return db.get(StudySheet, sheet_id)


def lock_sheets_in_workbook(
    db: Session, workbook_id: int, sheet_ids: list[int]
) -> list[StudySheet]:
    statement = (
        select(StudySheet)
        .where(StudySheet.workbook_id == workbook_id, StudySheet.id.in_(sheet_ids))
        .order_by(StudySheet.position)
        .with_for_update()
    )
    return list(db.scalars(statement).all())


def get_next_sheet_position(db: Session, workbook_id: int) -> int:
    current_max = db.scalar(
        select(func.max(StudySheet.position)).where(StudySheet.workbook_id == workbook_id)
    )
    return (current_max or 0) + 1


def refresh_workbook_counts(db: Session, workbook_id: int) -> None:
    sheet_count = db.scalar(
        select(func.count(StudySheet.id)).where(StudySheet.workbook_id == workbook_id)
    ) or 0
    total_cards = db.scalar(
        select(func.count(Flashcard.id))
        .join(StudySheet, Flashcard.sheet_id == StudySheet.id)
        .where(StudySheet.workbook_id == workbook_id)
    ) or 0
    workbook = db.get(Workbook, workbook_id)
    if workbook is not None:
        workbook.sheet_count = sheet_count
        workbook.total_cards = total_cards


def refresh_sheet_card_count(db: Session, sheet: StudySheet) -> None:
    sheet.card_count = db.scalar(
        select(func.count(Flashcard.id)).where(Flashcard.sheet_id == sheet.id)
    ) or 0
