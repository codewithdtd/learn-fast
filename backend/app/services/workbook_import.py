from pathlib import Path

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import Flashcard, StudySheet, Workbook
from app.services.excel_types import ParsedWorkbook


class UnsupportedWorkbookFileError(ValueError):
    """Raised when an upload is missing a filename or has an unsupported type."""


class InvalidWorkbookFilenameError(ValueError):
    """Raised when an upload filename cannot become a safe workbook name."""


class WorkbookImportPersistenceError(Exception):
    """Raised after an import transaction has been rolled back."""


def validate_xlsx_filename(filename: str | None) -> tuple[str, str]:
    """Return safe original filename and display name for a supported upload."""
    if not filename:
        raise UnsupportedWorkbookFileError("A workbook filename is required.")

    # Browsers may send Windows-style paths even when the API is deployed on
    # Linux, so normalize both separators before keeping only the basename.
    safe_filename = filename.replace("\\", "/").rsplit("/", maxsplit=1)[-1]
    if Path(safe_filename).suffix.lower() != ".xlsx":
        raise UnsupportedWorkbookFileError("Only .xlsx workbook files are supported.")

    workbook_name = Path(safe_filename).stem.strip()
    if not workbook_name:
        raise InvalidWorkbookFilenameError("Workbook filename must include a name.")
    if len(safe_filename) > 255 or len(workbook_name) > 255:
        raise InvalidWorkbookFilenameError("Workbook filename must be at most 255 characters.")

    return safe_filename, workbook_name


def import_parsed_workbook(
    db: Session,
    parsed_workbook: ParsedWorkbook,
    original_filename: str,
) -> Workbook:
    """Persist one fully validated workbook as a single database transaction."""
    safe_filename, workbook_name = validate_xlsx_filename(original_filename)
    sheet_count = len(parsed_workbook.sheets)
    total_cards = sum(len(sheet.cards) for sheet in parsed_workbook.sheets)
    workbook = Workbook(
        name=workbook_name,
        original_filename=safe_filename,
        sheet_count=sheet_count,
        total_cards=total_cards,
    )

    for parsed_sheet in parsed_workbook.sheets:
        sheet = StudySheet(
            name=parsed_sheet.sheet_name,
            position=parsed_sheet.position,
            card_count=len(parsed_sheet.cards),
        )
        for parsed_card in parsed_sheet.cards:
            sheet.flashcards.append(
                Flashcard(
                    position=parsed_card.position,
                    phrase=parsed_card.phrase,
                    meaning=parsed_card.meaning,
                    example_en=parsed_card.example_en,
                    example_vi=parsed_card.example_vi,
                )
            )
        workbook.sheets.append(sheet)

    try:
        db.add(workbook)
        # One commit keeps workbook, sheets and cards atomic: an error in any
        # child record cannot leave a partially imported workbook behind.
        db.commit()
        db.refresh(workbook)
    except SQLAlchemyError as error:
        db.rollback()
        raise WorkbookImportPersistenceError("Workbook import could not be saved.") from error

    return workbook
