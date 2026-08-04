from dataclasses import asdict
import logging

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.models import Workbook
from app.schemas.workbook import (
    WorkbookDetail,
    WorkbookImportResponse,
    WorkbookListItem,
    WorkbookUpdate,
)
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


def get_workbook_or_404(db: Session, workbook_id: int, *, include_sheets: bool = False) -> Workbook:
    statement = select(Workbook).where(Workbook.id == workbook_id)
    if include_sheets:
        # Detail serialization needs every sheet; load the collection in one
        # additional query instead of triggering a lazy query per sheet in UI/API.
        statement = statement.options(selectinload(Workbook.sheets))

    workbook = db.scalar(statement)
    if workbook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workbook not found.")
    return workbook


@router.get("/workbooks", response_model=list[WorkbookListItem])
def list_workbooks(db: Session = Depends(get_db)) -> list[WorkbookListItem]:
    workbooks = db.scalars(
        select(Workbook).order_by(Workbook.imported_at.desc(), Workbook.id.desc())
    ).all()
    return [WorkbookListItem.model_validate(workbook) for workbook in workbooks]


@router.get("/workbooks/{workbook_id}", response_model=WorkbookDetail)
def get_workbook(workbook_id: int, db: Session = Depends(get_db)) -> WorkbookDetail:
    workbook = get_workbook_or_404(db, workbook_id, include_sheets=True)
    return WorkbookDetail.model_validate(workbook)


@router.patch("/workbooks/{workbook_id}", response_model=WorkbookDetail)
def update_workbook(
    workbook_id: int,
    update: WorkbookUpdate,
    db: Session = Depends(get_db),
) -> WorkbookDetail:
    workbook = get_workbook_or_404(db, workbook_id)
    workbook.name = update.name
    try:
        db.commit()
        # Re-query with the detail loader so the response reflects the saved
        # name and keeps the existing sheet ordering contract.
        updated_workbook = get_workbook_or_404(db, workbook_id, include_sheets=True)
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Workbook update failed after database rollback.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Workbook could not be updated. Please try again.",
        ) from error

    return WorkbookDetail.model_validate(updated_workbook)


@router.delete("/workbooks/{workbook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workbook(workbook_id: int, db: Session = Depends(get_db)) -> Response:
    workbook = get_workbook_or_404(db, workbook_id)
    try:
        db.delete(workbook)
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Workbook deletion failed after database rollback.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Workbook could not be deleted. Please try again.",
        ) from error

    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
