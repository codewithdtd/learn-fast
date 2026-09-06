from dataclasses import asdict
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user_optional
from app.core.database import get_db
from app.models import User, Workbook
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


def get_workbook_or_404(
    db: Session,
    workbook_id: int,
    *,
    include_sheets: bool = False,
    current_user: Optional[User] = None,
) -> Workbook:
    statement = select(Workbook).where(Workbook.id == workbook_id)
    if current_user is not None:
        # User can view their own workbooks, or unassigned legacy workbooks
        statement = statement.where(
            or_(Workbook.user_id == current_user.id, Workbook.user_id.is_(None))
        )
    if include_sheets:
        statement = statement.options(selectinload(Workbook.sheets))

    workbook = db.scalar(statement)
    if workbook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workbook not found.")
    return workbook


@router.get("/workbooks", response_model=list[WorkbookListItem])
def list_workbooks(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> list[WorkbookListItem]:
    statement = select(Workbook)
    if current_user is not None:
        statement = statement.where(
            or_(Workbook.user_id == current_user.id, Workbook.user_id.is_(None))
        )
    workbooks = db.scalars(
        statement.order_by(Workbook.imported_at.desc(), Workbook.id.desc())
    ).all()
    return [WorkbookListItem.model_validate(workbook) for workbook in workbooks]


@router.get("/workbooks/{workbook_id}", response_model=WorkbookDetail)
def get_workbook(
    workbook_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> WorkbookDetail:
    workbook = get_workbook_or_404(db, workbook_id, include_sheets=True, current_user=current_user)
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
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> WorkbookImportResponse:
    try:
        validate_xlsx_filename(file.filename)
        parsed_workbook = parse_excel_workbook(file.file)
        workbook = import_parsed_workbook(
            db=db,
            parsed_workbook=parsed_workbook,
            original_filename=file.filename or "",
            user_id=current_user.id if current_user else None,
        )
    except UnsupportedWorkbookFileError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except InvalidWorkbookFilenameError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error
    except ExcelParseError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except ExcelValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[asdict(item) for item in error.errors],
        ) from error
    except WorkbookImportPersistenceError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Workbook import could not be saved. Please try again.",
        ) from error

    return WorkbookImportResponse.model_validate(workbook)
