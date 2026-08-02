from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    Flashcard,
    SheetStatus,
    StudySession,
    StudySessionCard,
    StudySessionStatus,
    StudySheet,
    Workbook,
)
from tests.test_management_api import create_workbook


def create_session_source(db_session: Session, name: str = "Study session source"):
    workbook = create_workbook(db_session, name, datetime.now(timezone.utc))
    sheet = next(item for item in workbook.sheets if item.position == 1)
    cards = sorted(sheet.flashcards, key=lambda card: card.position)
    return sheet, cards


def create_session(api_client: TestClient, sheet_id: int, **overrides):
    payload = {
        "sheet_id": sheet_id,
        "session_type": "new_learning",
        "direction": "en_to_vi",
    }
    payload.update(overrides)
    response = api_client.post("/api/v1/study-sessions", json=payload)
    assert response.status_code == 201
    return response.json()


def complete_session_with_remembered_cards(
    api_client: TestClient,
    session_id: int,
    cards: list[Flashcard],
) -> None:
    for card in cards:
        answer = api_client.post(
            f"/api/v1/study-sessions/{session_id}/cards/{card.id}/answer",
            json={"direction": "en_to_vi", "result": "remembered"},
        )
        assert answer.status_code == 200
    completion = api_client.post(f"/api/v1/study-sessions/{session_id}/complete")
    assert completion.status_code == 200


def test_create_and_get_session_snapshots_cards_in_import_order(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, cards = create_session_source(db_session)

    created = create_session(api_client, sheet.id)
    fetched = api_client.get(f"/api/v1/study-sessions/{created['id']}")

    assert created["sheet_id"] == sheet.id
    assert created["status"] == "active"
    assert created["total_cards"] == 2
    assert [item["flashcard"]["phrase"] for item in created["session_cards"]] == [
        "one",
        "two",
    ]
    assert [item["direction"] for item in created["session_cards"]] == [
        "en_to_vi",
        "en_to_vi",
    ]
    assert fetched.status_code == 200
    assert fetched.json()["session_cards"] == created["session_cards"]
    assert [card.id for card in cards] == [
        item["flashcard_id"] for item in created["session_cards"]
    ]


def test_weak_card_session_enrolls_only_weak_cards(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, cards = create_session_source(db_session)
    cards[1].is_weak = True
    db_session.commit()

    created = create_session(
        api_client,
        sheet.id,
        session_type="weak_cards",
        direction="vi_to_en",
    )

    assert created["total_cards"] == 1
    assert created["session_cards"][0]["flashcard_id"] == cards[1].id
    assert created["session_cards"][0]["direction"] == "vi_to_en"


def test_create_session_rejects_empty_sources_and_missing_sheet(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, _ = create_session_source(db_session)
    no_weak = api_client.post(
        "/api/v1/study-sessions",
        json={"sheet_id": sheet.id, "session_type": "weak_cards", "direction": "en_to_vi"},
    )
    workbook = Workbook(name="Empty", original_filename="empty.xlsx")
    empty_sheet = StudySheet(name="Empty sheet", position=1)
    workbook.sheets.append(empty_sheet)
    db_session.add(workbook)
    db_session.commit()
    empty = api_client.post(
        "/api/v1/study-sessions",
        json={"sheet_id": empty_sheet.id, "session_type": "new_learning", "direction": "en_to_vi"},
    )
    missing = api_client.post(
        "/api/v1/study-sessions",
        json={"sheet_id": 999, "session_type": "new_learning", "direction": "en_to_vi"},
    )

    assert no_weak.status_code == 422
    assert empty.status_code == 422
    assert missing.status_code == 404
    assert db_session.query(StudySession).count() == 0


def test_answers_track_again_remembered_and_first_try_stats(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, cards = create_session_source(db_session)
    session = create_session(api_client, sheet.id)
    first_card_id = cards[0].id

    again = api_client.post(
        f"/api/v1/study-sessions/{session['id']}/cards/{first_card_id}/answer",
        json={"direction": "en_to_vi", "result": "again"},
    )
    remembered = api_client.post(
        f"/api/v1/study-sessions/{session['id']}/cards/{first_card_id}/answer",
        json={"direction": "en_to_vi", "result": "remembered"},
    )
    persisted = api_client.get(f"/api/v1/study-sessions/{session['id']}").json()
    original_card = db_session.get(Flashcard, first_card_id)

    assert again.status_code == 200
    assert again.json()["attempt_count"] == 1
    assert again.json()["again_count"] == 1
    assert again.json()["remembered"] is False
    assert remembered.status_code == 200
    assert remembered.json()["attempt_count"] == 2
    assert remembered.json()["remembered"] is True
    assert remembered.json()["first_try_correct"] is False
    assert remembered.json()["session_again_count"] == 1
    assert persisted["total_attempts"] == 2
    assert persisted["first_try_correct"] == 0
    # Session answers are not card-level analytics; Quick Recall owns those
    # fields until Mastery policy is implemented in a later day.
    assert original_card.correct_count == 0
    assert original_card.incorrect_count == 0


def test_first_attempt_remembered_and_mixed_direction_rules(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, cards = create_session_source(db_session)
    fixed_session = create_session(api_client, sheet.id)
    mismatch = api_client.post(
        f"/api/v1/study-sessions/{fixed_session['id']}/cards/{cards[0].id}/answer",
        json={"direction": "vi_to_en", "result": "remembered"},
    )
    first_try = api_client.post(
        f"/api/v1/study-sessions/{fixed_session['id']}/cards/{cards[0].id}/answer",
        json={"direction": "en_to_vi", "result": "remembered"},
    )
    mixed_session = create_session(api_client, sheet.id, direction="mixed")
    mixed_again = api_client.post(
        f"/api/v1/study-sessions/{mixed_session['id']}/cards/{cards[1].id}/answer",
        json={"direction": "vi_to_en", "result": "again"},
    )
    mixed_mismatch = api_client.post(
        f"/api/v1/study-sessions/{mixed_session['id']}/cards/{cards[1].id}/answer",
        json={"direction": "en_to_vi", "result": "again"},
    )

    assert mismatch.status_code == 422
    assert first_try.status_code == 200
    assert first_try.json()["first_try_correct"] is True
    assert first_try.json()["session_first_try_correct"] == 1
    assert mixed_again.status_code == 200
    assert mixed_again.json()["direction"] == "vi_to_en"
    assert mixed_mismatch.status_code == 422


def test_answer_rejects_unknown_remembered_inactive_and_invalid_resources(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, cards = create_session_source(db_session)
    session = create_session(api_client, sheet.id)
    card_id = cards[0].id
    remembered = api_client.post(
        f"/api/v1/study-sessions/{session['id']}/cards/{card_id}/answer",
        json={"direction": "en_to_vi", "result": "remembered"},
    )
    duplicate = api_client.post(
        f"/api/v1/study-sessions/{session['id']}/cards/{card_id}/answer",
        json={"direction": "en_to_vi", "result": "again"},
    )
    unknown_card = api_client.post(
        f"/api/v1/study-sessions/{session['id']}/cards/999/answer",
        json={"direction": "en_to_vi", "result": "again"},
    )
    session_model = db_session.get(StudySession, session["id"])
    session_model.status = StudySessionStatus.ABANDONED
    db_session.commit()
    inactive = api_client.post(
        f"/api/v1/study-sessions/{session['id']}/cards/{cards[1].id}/answer",
        json={"direction": "en_to_vi", "result": "again"},
    )
    invalid = api_client.post(
        f"/api/v1/study-sessions/{session['id']}/cards/{cards[1].id}/answer",
        json={"direction": "mixed", "result": "again"},
    )
    missing_session = api_client.get("/api/v1/study-sessions/999")

    assert remembered.status_code == 200
    assert duplicate.status_code == 409
    assert unknown_card.status_code == 404
    assert inactive.status_code == 409
    assert invalid.status_code == 422
    assert missing_session.status_code == 404


def test_complete_session_requires_every_card_to_be_remembered(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, cards = create_session_source(db_session)
    session = create_session(api_client, sheet.id)
    api_client.post(
        f"/api/v1/study-sessions/{session['id']}/cards/{cards[0].id}/answer",
        json={"direction": "en_to_vi", "result": "remembered"},
    )

    completion = api_client.post(f"/api/v1/study-sessions/{session['id']}/complete")
    stored = api_client.get(f"/api/v1/study-sessions/{session['id']}").json()

    assert completion.status_code == 422
    assert "1 card" in completion.json()["detail"]
    assert stored["status"] == "active"
    assert stored["completed_at"] is None
    assert stored["mastery_score"] is None


def test_complete_session_persists_score_and_is_idempotent(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, cards = create_session_source(db_session)
    session = create_session(api_client, sheet.id)

    for card in cards:
        response = api_client.post(
            f"/api/v1/study-sessions/{session['id']}/cards/{card.id}/answer",
            json={"direction": "en_to_vi", "result": "remembered"},
        )
        assert response.status_code == 200

    completed = api_client.post(f"/api/v1/study-sessions/{session['id']}/complete")
    repeated = api_client.post(f"/api/v1/study-sessions/{session['id']}/complete")

    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["total_attempts"] == 2
    assert completed.json()["first_try_correct"] == 2
    assert completed.json()["again_count"] == 0
    assert completed.json()["mastery_score"] == 100.0
    assert completed.json()["completed_at"] is not None
    assert repeated.status_code == 200
    assert repeated.json()["completed_at"] == completed.json()["completed_at"]
    assert repeated.json()["mastery_score"] == completed.json()["mastery_score"]


def test_complete_session_preserves_again_counters_and_weak_source(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, cards = create_session_source(db_session)
    cards[1].is_weak = True
    db_session.commit()
    session = create_session(
        api_client,
        sheet.id,
        session_type="weak_cards",
        direction="en_to_vi",
    )

    again = api_client.post(
        f"/api/v1/study-sessions/{session['id']}/cards/{cards[1].id}/answer",
        json={"direction": "en_to_vi", "result": "again"},
    )
    remembered = api_client.post(
        f"/api/v1/study-sessions/{session['id']}/cards/{cards[1].id}/answer",
        json={"direction": "en_to_vi", "result": "remembered"},
    )
    completed = api_client.post(f"/api/v1/study-sessions/{session['id']}/complete")

    assert again.status_code == 200
    assert remembered.status_code == 200
    assert completed.status_code == 200
    assert completed.json()["total_cards"] == 1
    assert completed.json()["total_attempts"] == 2
    assert completed.json()["again_count"] == 1
    assert completed.json()["first_try_correct"] == 0
    assert completed.json()["mastery_score"] == 0.0
    assert [item["flashcard_id"] for item in completed.json()["session_cards"]] == [cards[1].id]
    assert completed.json()["session_cards"][0]["flashcard"]["is_weak"] is True


def test_complete_session_rejects_abandoned_session(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, _ = create_session_source(db_session)
    session = create_session(api_client, sheet.id)
    stored_session = db_session.get(StudySession, session["id"])
    stored_session.status = StudySessionStatus.ABANDONED
    db_session.commit()

    completion = api_client.post(f"/api/v1/study-sessions/{session['id']}/complete")

    assert completion.status_code == 409
    assert "active" in completion.json()["detail"]


def test_rating_completed_session_schedules_sheet_and_is_idempotent(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, cards = create_session_source(db_session)
    session = create_session(api_client, sheet.id)
    complete_session_with_remembered_cards(api_client, session["id"], cards)

    rated = api_client.post(
        f"/api/v1/study-sessions/{session['id']}/rating",
        json={"rating": "good"},
    )
    repeated = api_client.post(
        f"/api/v1/study-sessions/{session['id']}/rating",
        json={"rating": "good"},
    )
    conflicting = api_client.post(
        f"/api/v1/study-sessions/{session['id']}/rating",
        json={"rating": "easy"},
    )

    assert rated.status_code == 200
    scheduled_sheet = rated.json()["sheet"]
    assert rated.json()["session"]["sheet_rating"] == "good"
    assert scheduled_sheet["status"] == "learned"
    assert scheduled_sheet["srs_level"] == 1
    assert scheduled_sheet["interval_days"] == 1
    assert scheduled_sheet["review_count"] == 1
    assert scheduled_sheet["lapse_count"] == 0
    assert scheduled_sheet["first_learned_at"] is not None
    assert scheduled_sheet["last_reviewed_at"] is not None
    assert scheduled_sheet["next_review_at"] is not None
    assert repeated.status_code == 200
    assert repeated.json()["sheet"]["review_count"] == 1
    assert repeated.json()["sheet"]["next_review_at"] == scheduled_sheet["next_review_at"]
    assert conflicting.status_code == 409
    assert db_session.get(StudySheet, sheet.id).srs_level == 1


def test_rating_review_and_forgot_updates_existing_srs_state(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, cards = create_session_source(db_session)
    sheet.status = SheetStatus.DUE
    sheet.srs_level = 1
    sheet.interval_days = 1
    sheet.review_count = 2
    sheet.lapse_count = 1
    db_session.commit()
    review_session = create_session(api_client, sheet.id, session_type="srs_review")
    complete_session_with_remembered_cards(api_client, review_session["id"], cards)

    good = api_client.post(
        f"/api/v1/study-sessions/{review_session['id']}/rating",
        json={"rating": "good"},
    )

    assert good.status_code == 200
    assert good.json()["sheet"]["srs_level"] == 2
    assert good.json()["sheet"]["interval_days"] == 3
    assert good.json()["sheet"]["review_count"] == 3

    sheet, cards = create_session_source(db_session, "Forgot review")
    sheet.status = SheetStatus.DUE
    sheet.srs_level = 5
    sheet.interval_days = 30
    sheet.lapse_count = 4
    db_session.commit()
    forgot_session = create_session(api_client, sheet.id, session_type="srs_review")
    complete_session_with_remembered_cards(api_client, forgot_session["id"], cards)
    forgot = api_client.post(
        f"/api/v1/study-sessions/{forgot_session['id']}/rating",
        json={"rating": "forgot"},
    )

    assert forgot.status_code == 200
    assert forgot.json()["sheet"]["srs_level"] == 1
    assert forgot.json()["sheet"]["interval_days"] == 1
    assert forgot.json()["sheet"]["lapse_count"] == 5


def test_rating_rejects_ineligible_or_incomplete_sessions(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, cards = create_session_source(db_session)
    active_session = create_session(api_client, sheet.id)
    active_rating = api_client.post(
        f"/api/v1/study-sessions/{active_session['id']}/rating",
        json={"rating": "good"},
    )
    cards[1].is_weak = True
    db_session.commit()
    weak_session = create_session(api_client, sheet.id, session_type="weak_cards")
    complete_session_with_remembered_cards(api_client, weak_session["id"], [cards[1]])
    weak_rating = api_client.post(
        f"/api/v1/study-sessions/{weak_session['id']}/rating",
        json={"rating": "good"},
    )

    assert active_rating.status_code == 409
    assert weak_rating.status_code == 422
    assert db_session.get(StudySheet, sheet.id).review_count == 0


def test_due_and_not_started_routes_filter_sheets_and_keep_static_route_order(
    api_client: TestClient, db_session: Session
) -> None:
    workbook = create_workbook(db_session, "SRS lists", datetime.now(timezone.utc))
    due_sheet = next(sheet for sheet in workbook.sheets if sheet.position == 1)
    future_sheet = next(sheet for sheet in workbook.sheets if sheet.position == 2)
    due_sheet.status = SheetStatus.LEARNED
    due_sheet.next_review_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    future_sheet.status = SheetStatus.LEARNED
    future_sheet.next_review_at = datetime.now(timezone.utc) + timedelta(days=1)
    untouched_workbook = create_workbook(db_session, "Unstarted", datetime.now(timezone.utc))
    db_session.commit()

    due = api_client.get("/api/v1/sheets/due")
    not_started = api_client.get("/api/v1/sheets/not-started")

    assert due.status_code == 200
    assert [sheet["id"] for sheet in due.json()] == [due_sheet.id]
    assert due.json()[0]["status"] == "due"
    assert db_session.get(StudySheet, due_sheet.id).status is SheetStatus.DUE
    assert not_started.status_code == 200
    assert {sheet["id"] for sheet in not_started.json()} == {
        sheet.id for sheet in untouched_workbook.sheets
    }


def test_study_session_rating_post_cors_preflight(api_client: TestClient) -> None:
    response = api_client.options(
        "/api/v1/study-sessions/1/rating",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "POST" in response.headers["access-control-allow-methods"]


def test_deleting_a_workbook_cascades_its_study_sessions(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, _ = create_session_source(db_session)
    session = create_session(api_client, sheet.id)

    deleted = api_client.delete(f"/api/v1/workbooks/{sheet.workbook_id}")

    assert deleted.status_code == 204
    assert db_session.get(StudySession, session["id"]) is None
    assert db_session.query(StudySessionCard).count() == 0


def test_study_session_post_cors_preflight(api_client: TestClient) -> None:
    response = api_client.options(
        "/api/v1/study-sessions",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "content-type" in response.headers["access-control-allow-headers"].lower()


def test_study_session_complete_post_cors_preflight(api_client: TestClient) -> None:
    response = api_client.options(
        "/api/v1/study-sessions/1/complete",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "POST" in response.headers["access-control-allow-methods"]
