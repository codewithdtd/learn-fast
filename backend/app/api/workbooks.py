from dataclasses import asdict
import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.workbook import WorkbookImportResponse
from app.services.excel_parser import parse_excel_workbook
from app.services.excel_types import ExcelParseError, ExcelValidationError
from app.services.workbook_import import (
    InvalidWorkbookFilenameError,
    UnsupportedWorkbookFileError,
    WorkbookImportPersistenceError,
    import_parsed_workbook,
    validate_xlsx_filename,
)


logger = logging.getLogger(__name__)
router = APIRouter(tags=["workbooks"])


@router.post(
    "/workbooks/import",
    response_model=WorkbookImportResponse,
    status_code=status.HTTP_201_CREATED,
)
def import_workbook(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> WorkbookImportResponse:
    try:
        validate_xlsx_filename(file.filename)
        parsed_workbook = parse_excel_workbook(file.file)
        workbook = import_parsed_workbook(db, parsed_workbook, file.filename or "")
    except UnsupportedWorkbookFileError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except InvalidWorkbookFilenameError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)
        ) from error
    except ExcelParseError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except ExcelValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=[asdict(item) for item in error.errors],
        ) from error
    except WorkbookImportPersistenceError as error:
        logger.exception("Workbook import failed after database rollback.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Workbook import could not be saved. Please try again.",
        ) from error

    return WorkbookImportResponse.model_validate(workbook)
