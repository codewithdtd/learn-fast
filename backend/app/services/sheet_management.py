from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.repositories.workbooks import (
    get_sheet,
    get_next_sheet_position,
    get_workbook,
    lock_workbook_for_sheet_management,
    lock_sheets_in_workbook,
    refresh_workbook_counts,
)
from app.models import StudySheet, Workbook


class SheetMoveError(ValueError):
    """Raised when a requested sheet move cannot be applied safely."""


class WorkbookNotFoundError(SheetMoveError):
    pass


class SheetsNotFoundError(SheetMoveError):
    pass


class InvalidSheetMoveError(SheetMoveError):
    pass


class StudySheetNotFoundError(SheetMoveError):
    pass


def create_workbook(db: Session, *, name: str, owner_id: int) -> Workbook:
    workbook = Workbook(name=name, original_filename="Created manually", user_id=owner_id)
    try:
        db.add(workbook)
        db.commit()
        db.refresh(workbook)
    except SQLAlchemyError:
        db.rollback()
        raise
    return workbook


def create_sheet(db: Session, *, workbook_id: int, name: str) -> None:
    workbook = lock_workbook_for_sheet_management(db, workbook_id)
    if workbook is None:
        raise WorkbookNotFoundError("Workbook not found.")
    try:
        db.add(
            StudySheet(
                workbook_id=workbook_id,
                name=name,
                position=get_next_sheet_position(db, workbook_id),
            )
        )
        db.flush()
        refresh_workbook_counts(db, workbook_id)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise


def delete_sheet(db: Session, *, sheet_id: int) -> None:
    sheet = get_sheet(db, sheet_id)
    if sheet is None:
        raise StudySheetNotFoundError("Study sheet not found.")
    workbook_id = sheet.workbook_id
    try:
        # Xóa sheet sẽ cascade flashcard và study session; cập nhật số liệu workbook cùng transaction.
        db.delete(sheet)
        db.flush()
        refresh_workbook_counts(db, workbook_id)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise


def move_sheets(
    db: Session,
    *,
    source_workbook_id: int,
    target_workbook_id: int,
    sheet_ids: list[int],
) -> int:
    if source_workbook_id == target_workbook_id:
        raise InvalidSheetMoveError("Choose a different destination workbook.")

    source = get_workbook(db, source_workbook_id)
    target = get_workbook(db, target_workbook_id)
    if source is None or target is None:
        raise WorkbookNotFoundError("Workbook not found.")

    sheets = lock_sheets_in_workbook(db, source_workbook_id, sheet_ids)
    if len(sheets) != len(sheet_ids):
        raise SheetsNotFoundError("One or more selected sheets were not found in this workbook.")

    next_position = get_next_sheet_position(db, target_workbook_id)
    try:
        # Cập nhật workbook_id trên bản ghi hiện hữu để giữ nguyên flashcard,
        # tiến độ SRS và study session gắn với sheet.
        for sheet in sheets:
            sheet.workbook_id = target_workbook_id
            sheet.position = next_position
            next_position += 1

        # Bộ đếm là dữ liệu hiển thị ở thư viện; cập nhật cùng transaction để
        # không xuất hiện số liệu lệch nếu thao tác chuyển sheet thất bại.
        refresh_workbook_counts(db, source_workbook_id)
        refresh_workbook_counts(db, target_workbook_id)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise

    return len(sheets)
