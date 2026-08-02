import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Flashcard,
    SheetPriority,
    SheetStatus,
    StudyDirection,
    StudySession,
    StudySessionCard,
    StudySessionStatus,
    StudySessionType,
    StudySheet,
    Workbook,
)


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


def test_persists_study_session_and_session_card_defaults(db_session: Session) -> None:
    workbook = Workbook(name="Session workbook", original_filename="session.xlsx")
    sheet = StudySheet(name="Session sheet", position=0)
    flashcard = Flashcard(position=0, phrase="carry out", meaning="thực hiện")
    sheet.flashcards.append(flashcard)
    workbook.sheets.append(sheet)
    db_session.add(workbook)
    db_session.commit()

    session = StudySession(
        sheet_id=sheet.id,
        session_type=StudySessionType.NEW_LEARNING,
        direction=StudyDirection.EN_TO_VI,
        total_cards=1,
    )
    session.session_cards.append(
        StudySessionCard(flashcard_id=flashcard.id, direction=StudyDirection.EN_TO_VI)
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    assert session.status is StudySessionStatus.ACTIVE
    assert session.total_attempts == 0
    assert session.again_count == 0
    assert session.session_cards[0].remembered is False
    assert session.session_cards[0].attempt_count == 0
    assert session.session_cards[0].flashcard is flashcard
