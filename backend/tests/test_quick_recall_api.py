from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Flashcard
from tests.test_management_api import create_workbook


def create_sheet_cards(db_session: Session):
    workbook = create_workbook(db_session, "Quick Recall", datetime.now(timezone.utc))
    first_sheet = next(sheet for sheet in workbook.sheets if sheet.position == 1)
    cards = sorted(first_sheet.flashcards, key=lambda card: card.position)
    cards[0].is_weak = True
    db_session.commit()
    return first_sheet, cards


def test_complete_quick_recall_updates_counts_results_and_weak_cards(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, cards = create_sheet_cards(db_session)

    response = api_client.post(
        f"/api/v1/sheets/{sheet.id}/quick-recall/complete",
        json={
            "results": [
                {"flashcard_id": cards[0].id, "result": "remembered"},
                {"flashcard_id": cards[1].id, "result": "need_review"},
            ]
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["sheet_id"] == sheet.id
    assert payload["total_cards"] == 2
    assert payload["remembered_count"] == 1
    assert payload["need_review_count"] == 1
    assert payload["recall_percentage"] == 50.0
    assert payload["completed_at"]

    remembered_card = db_session.get(Flashcard, cards[0].id)
    review_card = db_session.get(Flashcard, cards[1].id)
    assert remembered_card.correct_count == 1
    assert remembered_card.incorrect_count == 0
    assert remembered_card.last_result == "remembered"
    assert remembered_card.last_reviewed_at is not None
    # A successful answer must not erase a weakness recorded before this pass.
    assert remembered_card.is_weak is True
    assert review_card.correct_count == 0
    assert review_card.incorrect_count == 1
    assert review_card.last_result == "need_review"
    assert review_card.last_reviewed_at == remembered_card.last_reviewed_at
    assert review_card.is_weak is True

    cards_response = api_client.get(f"/api/v1/sheets/{sheet.id}/cards")
    assert [card["is_weak"] for card in cards_response.json()] == [True, True]


def test_quick_recall_rejects_incomplete_foreign_and_duplicate_results_atomically(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, cards = create_sheet_cards(db_session)
    other_sheet, other_cards = create_sheet_cards(db_session)
    before = [(card.correct_count, card.incorrect_count, card.last_result) for card in cards]

    incomplete = api_client.post(
        f"/api/v1/sheets/{sheet.id}/quick-recall/complete",
        json={"results": [{"flashcard_id": cards[0].id, "result": "remembered"}]},
    )
    foreign = api_client.post(
        f"/api/v1/sheets/{sheet.id}/quick-recall/complete",
        json={
            "results": [
                {"flashcard_id": cards[0].id, "result": "remembered"},
                {"flashcard_id": other_cards[0].id, "result": "need_review"},
            ]
        },
    )
    duplicate = api_client.post(
        f"/api/v1/sheets/{sheet.id}/quick-recall/complete",
        json={
            "results": [
                {"flashcard_id": cards[0].id, "result": "remembered"},
                {"flashcard_id": cards[0].id, "result": "need_review"},
            ]
        },
    )

    assert incomplete.status_code == 422
    assert foreign.status_code == 422
    assert duplicate.status_code == 422
    assert other_sheet.id != sheet.id
    assert [
        (
            db_session.get(Flashcard, card.id).correct_count,
            db_session.get(Flashcard, card.id).incorrect_count,
            db_session.get(Flashcard, card.id).last_result,
        )
        for card in cards
    ] == before


def test_quick_recall_rejects_invalid_input_and_missing_sheet(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, cards = create_sheet_cards(db_session)

    empty = api_client.post(
        f"/api/v1/sheets/{sheet.id}/quick-recall/complete", json={"results": []}
    )
    invalid_result = api_client.post(
        f"/api/v1/sheets/{sheet.id}/quick-recall/complete",
        json={
            "results": [
                {"flashcard_id": cards[0].id, "result": "wrong"},
                {"flashcard_id": cards[1].id, "result": "remembered"},
            ]
        },
    )
    unknown_field = api_client.post(
        f"/api/v1/sheets/{sheet.id}/quick-recall/complete",
        json={
            "results": [
                {"flashcard_id": cards[0].id, "result": "remembered"},
                {"flashcard_id": cards[1].id, "result": "need_review"},
            ],
            "unexpected": True,
        },
    )
    missing_sheet = api_client.post(
        "/api/v1/sheets/999/quick-recall/complete",
        json={"results": [{"flashcard_id": 1, "result": "remembered"}]},
    )

    assert empty.status_code == 422
    assert invalid_result.status_code == 422
    assert unknown_field.status_code == 422
    assert missing_sheet.status_code == 404


def test_quick_recall_post_cors_preflight(api_client: TestClient) -> None:
    response = api_client.options(
        "/api/v1/sheets/1/quick-recall/complete",
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
