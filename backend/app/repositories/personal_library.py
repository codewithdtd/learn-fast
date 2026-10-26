from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import StudySheet, User, Workbook


READING_VOCABULARY_FILENAME = "__learn_fast_reading_vocabulary__"


def get_reading_vocabulary_workbook(db: Session, user_id: int) -> Workbook | None:
    statement = select(Workbook).where(
        Workbook.user_id == user_id,
        Workbook.original_filename == READING_VOCABULARY_FILENAME,
    ).options(selectinload(Workbook.sheets))
    return db.scalar(statement)


def list_user_vocabulary_sheets(db: Session, user_id: int) -> list[StudySheet]:
    statement = (
        select(StudySheet)
        .join(Workbook, StudySheet.workbook_id == Workbook.id)
        .where(Workbook.user_id == user_id)
        .options(selectinload(StudySheet.workbook))
        .order_by(Workbook.name, StudySheet.position)
    )
    return list(db.scalars(statement).all())


def get_user_vocabulary_sheet(db: Session, sheet_id: int, user_id: int) -> StudySheet | None:
    statement = (
        select(StudySheet)
        .join(Workbook, StudySheet.workbook_id == Workbook.id)
        .where(StudySheet.id == sheet_id, Workbook.user_id == user_id)
        .options(selectinload(StudySheet.workbook))
    )
    return db.scalar(statement)


def insert_reading_vocabulary_sheet(db: Session, user_id: int) -> StudySheet:
    workbook = Workbook(
        user_id=user_id,
        name="My Reading Vocabulary",
        original_filename=READING_VOCABULARY_FILENAME,
        sheet_count=1,
        total_cards=0,
    )
    db.add(workbook)
    db.flush()
    sheet = StudySheet(workbook_id=workbook.id, name="News Words", position=1, card_count=0)
    db.add(sheet)
    db.flush()
    return sheet


def lock_user(db: Session, user_id: int) -> User | None:
    # Khóa hàng user làm điểm đồng bộ khi nhiều request cùng tạo thư viện mặc định lần đầu trên PostgreSQL.
    return db.scalar(select(User).where(User.id == user_id).with_for_update())
