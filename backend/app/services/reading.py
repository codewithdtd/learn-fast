import logging

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import StudySheet
from app.repositories.personal_library import (
    get_reading_vocabulary_workbook,
    insert_reading_vocabulary_sheet,
    list_user_vocabulary_sheets,
    lock_user,
)
from app.schemas.reading import ReadingVocabularySheet


logger = logging.getLogger(__name__)


class ReadingLibraryPersistenceError(RuntimeError):
    """Raised when a user's private reading vocabulary sheet cannot be saved."""


def list_reading_vocabulary_sheets(db: Session, user_id: int) -> list[ReadingVocabularySheet]:
    return [_to_reading_sheet(sheet) for sheet in list_user_vocabulary_sheets(db, user_id)]


def create_reading_vocabulary_sheet(db: Session, user_id: int) -> ReadingVocabularySheet:
    """Tạo sheet từ vựng riêng một lần; khóa chủ sở hữu ngăn request đồng thời sinh bản trùng."""
    try:
        if lock_user(db, user_id) is None:
            raise ReadingLibraryPersistenceError("The signed-in account could not be found.")
        workbook = get_reading_vocabulary_workbook(db, user_id)
        if workbook is not None and workbook.sheets:
            return _to_reading_sheet(workbook.sheets[0])
        sheet = insert_reading_vocabulary_sheet(db, user_id)
        db.commit()
        db.refresh(sheet, attribute_names=["workbook"])
        return _to_reading_sheet(sheet)
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Private reading vocabulary collection creation failed after rollback.")
        raise ReadingLibraryPersistenceError("Your vocabulary sheet could not be created. Please try again.") from error


def _to_reading_sheet(sheet: StudySheet) -> ReadingVocabularySheet:
    return ReadingVocabularySheet(
        id=sheet.id,
        name=sheet.name,
        workbook_id=sheet.workbook_id,
        workbook_name=sheet.workbook.name,
        card_count=sheet.card_count,
    )
