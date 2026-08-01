from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    Flashcard,
    SheetStatus,
    StudyDirection,
    StudySession,
    StudySessionStatus,
    StudySessionType,
    StudySheet,
    Workbook,
)


def create_dashboard_sheet(
    db_session: Session,
    name: str,
    *,
    status: SheetStatus = SheetStatus.NOT_STARTED,
    position: int = 1,
) -> StudySheet:
    workbook = Workbook(name=f"{name} workbook", original_filename=f"{name}.xlsx")
    sheet = StudySheet(name=name, position=position, status=status)
    sheet.flashcards = [
        Flashcard(position=1, phrase=f"{name} phrase", meaning=f"{name} meaning"),
    ]
    workbook.sheets.append(sheet)
    db_session.add(workbook)
    db_session.commit()
    return sheet


def add_session(
    db_session: Session,
    sheet: StudySheet,
    *,
    session_type: StudySessionType = StudySessionType.NEW_LEARNING,
    status: StudySessionStatus = StudySessionStatus.ACTIVE,
    started_at: datetime,
    completed_at: datetime | None = None,
    mastery_score: float | None = None,
) -> StudySession:
    session = StudySession(
        sheet_id=sheet.id,
        session_type=session_type,
        direction=StudyDirection.EN_TO_VI,
        status=status,
        started_at=started_at,
        completed_at=completed_at,
        total_cards=1,
        total_attempts=1 if completed_at else 0,
        first_try_correct=1 if completed_at else 0,
        mastery_score=mastery_score,
    )
    db_session.add(session)
    db_session.commit()
    return session


def test_dashboard_groups_due_active_new_weak_and_recent_data(
    api_client: TestClient, db_session: Session
) -> None:
    now = datetime.now(timezone.utc)
    due_sheet = create_dashboard_sheet(db_session, "Due", status=SheetStatus.LEARNED)
    due_sheet.next_review_at = now - timedelta(seconds=1)
    future_sheet = create_dashboard_sheet(db_session, "Future", status=SheetStatus.LEARNED)
    future_sheet.next_review_at = now + timedelta(days=1)
    new_sheet = create_dashboard_sheet(db_session, "New")
    active_sheet = create_dashboard_sheet(db_session, "Continue")
    active_sheet.flashcards[0].is_weak = True
    due_sheet.flashcards[0].is_weak = True
    db_session.commit()

    older_active = add_session(db_session, active_sheet, started_at=now - timedelta(minutes=10))
    newer_active = add_session(db_session, active_sheet, started_at=now - timedelta(minutes=1))
    completed_sessions = [
        add_session(
            db_session,
            new_sheet,
            status=StudySessionStatus.COMPLETED,
            started_at=now - timedelta(hours=index + 1),
            completed_at=now - timedelta(minutes=index),
            mastery_score=None if index == 0 else float(100 - index),
        )
        for index in range(6)
    ]

    response = api_client.get("/api/v1/dashboard", headers={"Origin": "http://localhost:3000"})
    payload = response.json()

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert [sheet["id"] for sheet in payload["due_sheets"]] == [due_sheet.id]
    assert db_session.get(StudySheet, due_sheet.id).status is SheetStatus.DUE
    assert [session["id"] for session in payload["active_sessions"]] == [
        newer_active.id,
        older_active.id,
    ]
    assert [sheet["id"] for sheet in payload["new_sheets"]] == [new_sheet.id]
    assert future_sheet.id not in [sheet["id"] for sheet in payload["due_sheets"]]
    assert active_sheet.id not in [sheet["id"] for sheet in payload["new_sheets"]]
    assert payload["weak_card_count"] == 2
    assert [session["id"] for session in payload["recent_sessions"]] == [
        session.id for session in completed_sessions[:5]
    ]
    assert payload["recent_sessions"][0]["mastery_score"] is None
    assert payload["generated_at"]

    repeated = api_client.get("/api/v1/dashboard")
    assert repeated.status_code == 200
    assert db_session.get(StudySheet, due_sheet.id).status is SheetStatus.DUE
    assert repeated.json()["due_sheets"][0]["next_review_at"] == payload["due_sheets"][0]["next_review_at"]


def test_dashboard_is_empty_and_srs_review_requires_a_due_sheet(
    api_client: TestClient, db_session: Session
) -> None:
    empty_dashboard = api_client.get("/api/v1/dashboard")
    empty_payload = empty_dashboard.json()
    assert empty_dashboard.status_code == 200
    assert empty_payload["generated_at"]
    assert empty_payload["due_sheets"] == []
    assert empty_payload["active_sessions"] == []
    assert empty_payload["new_sheets"] == []
    assert empty_payload["weak_card_count"] == 0
    assert empty_payload["recent_sessions"] == []

    sheet = create_dashboard_sheet(db_session, "Review validation")
    blocked = api_client.post(
        "/api/v1/study-sessions",
        json={"sheet_id": sheet.id, "session_type": "srs_review", "direction": "en_to_vi"},
    )
    sheet.status = SheetStatus.DUE
    db_session.commit()
    allowed = api_client.post(
        "/api/v1/study-sessions",
        json={"sheet_id": sheet.id, "session_type": "srs_review", "direction": "en_to_vi"},
    )

    assert blocked.status_code == 422
    assert "due" in blocked.json()["detail"]
    assert allowed.status_code == 201
    assert allowed.json()["session_type"] == "srs_review"
