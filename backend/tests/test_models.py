import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Flashcard, SheetPriority, SheetStatus, StudySheet, Workbook


def test_persists_workbook_sheet_and_flashcard_relationships(db_session: Session) -> None:
    workbook = Workbook(name="Business English", original_filename="business.xlsx")
    sheet = StudySheet(name="Meetings", position=0)
    flashcard = Flashcard(
        position=0,
        phrase="follow up",
        meaning="theo dõi, tiếp tục xử lý",
        example_en="I will follow up tomorrow.",
    )
    sheet.flashcards.append(flashcard)
    workbook.sheets.append(sheet)
    db_session.add(workbook)
    db_session.commit()
    db_session.expire_all()

    stored_workbook = db_session.scalar(select(Workbook))
    assert stored_workbook is not None
    assert stored_workbook.sheets[0].name == "Meetings"
    assert stored_workbook.sheets[0].flashcards[0].phrase == "follow up"
    assert stored_workbook.sheets[0].workbook is stored_workbook
    assert stored_workbook.sheets[0].flashcards[0].sheet is stored_workbook.sheets[0]


def test_models_apply_learning_defaults(db_session: Session) -> None:
    workbook = Workbook(name="Workbook", original_filename="workbook.xlsx")
    sheet = StudySheet(name="Sheet", position=0)
    flashcard = Flashcard(position=0, phrase="look into", meaning="xem xét")
    sheet.flashcards.append(flashcard)
    workbook.sheets.append(sheet)
    db_session.add(workbook)
    db_session.commit()
    db_session.refresh(workbook)
    db_session.refresh(sheet)
    db_session.refresh(flashcard)

    assert workbook.sheet_count == 0
    assert workbook.total_cards == 0
    assert sheet.status is SheetStatus.NOT_STARTED
    assert sheet.priority is SheetPriority.MEDIUM
    assert sheet.card_count == 0
    assert sheet.srs_level == 0
    assert sheet.review_count == 0
    assert flashcard.is_weak is False
    assert flashcard.is_bookmarked is False
    assert flashcard.correct_count == 0
    assert flashcard.incorrect_count == 0


def test_positions_are_unique_per_parent_but_reusable_across_parents(
    db_session: Session,
) -> None:
    first_workbook = Workbook(name="First", original_filename="first.xlsx")
    second_workbook = Workbook(name="Second", original_filename="second.xlsx")
    first_workbook.sheets.append(StudySheet(name="First sheet", position=0))
    second_workbook.sheets.append(StudySheet(name="Second sheet", position=0))
    db_session.add_all([first_workbook, second_workbook])
    db_session.commit()

    duplicate_sheet = StudySheet(
        workbook_id=first_workbook.id,
        name="Duplicate sheet",
        position=0,
    )
    db_session.add(duplicate_sheet)

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    first_sheet = first_workbook.sheets[0]
    first_sheet.flashcards.append(
        Flashcard(position=0, phrase="one", meaning="một")
    )
    db_session.commit()

    db_session.add(
        Flashcard(sheet_id=first_sheet.id, position=0, phrase="duplicate", meaning="trùng")
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
