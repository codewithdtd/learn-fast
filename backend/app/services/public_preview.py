from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import User, Workbook
from app.repositories.personal_library import READING_VOCABULARY_FILENAME


def get_guest_preview_workbook(db: Session) -> Workbook | None:
    """Choose one admin-owned workbook as a read-only showcase for non-admins."""
    workbook = db.scalar(
        select(Workbook)
        .join(User, Workbook.user_id == User.id)
        .where(User.is_superuser.is_(True), Workbook.original_filename != READING_VOCABULARY_FILENAME)
        .options(selectinload(Workbook.sheets))
        .order_by(Workbook.imported_at.desc(), Workbook.id.desc())
        .limit(1)
    )
    if workbook is not None:
        return workbook

    # A system-seeded ownerless workbook keeps the preview useful when no admin import exists.
    return db.scalar(
        select(Workbook)
        .where(Workbook.user_id.is_(None), Workbook.original_filename != READING_VOCABULARY_FILENAME)
        .options(selectinload(Workbook.sheets))
        .order_by(Workbook.imported_at.desc(), Workbook.id.desc())
        .limit(1)
    )
