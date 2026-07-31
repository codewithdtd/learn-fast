from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Flashcard
from tests.test_management_api import create_workbook


def get_first_sheet_and_cards(db_session: Session):
    workbook = create_workbook(db_session, "Table vocabulary", datetime.now(timezone.utc))
    first_sheet = next(sheet for sheet in workbook.sheets if sheet.position == 1)
    cards = sorted(first_sheet.flashcards, key=lambda card: card.position)
    return first_sheet, cards


def test_list_sheet_cards_returns_ordered_table_fields(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, cards = get_first_sheet_and_cards(db_session)
    cards[0].example_en = None
    cards[0].example_vi = None
    db_session.commit()

    response = api_client.get(f"/api/v1/sheets/{sheet.id}/cards")

    assert response.status_code == 200
    payload = response.json()
    assert [item["position"] for item in payload] == [1, 2]
    assert [item["phrase"] for item in payload] == ["one", "two"]
    assert payload[0]["example_en"] is None
    assert payload[0]["example_vi"] is None
    assert set(payload[0]) == {
        "id",
        "position",
        "phrase",
        "meaning",
        "example_en",
        "example_vi",
        "is_weak",
        "is_bookmarked",
    }


def test_flashcard_weak_and_bookmark_flags_persist(
    api_client: TestClient, db_session: Session
) -> None:
    _, cards = get_first_sheet_and_cards(db_session)
    first_card, second_card = cards

    mark_weak = api_client.patch(
        f"/api/v1/flashcards/{first_card.id}/weak", json={"is_weak": True}
    )
    unmark_weak = api_client.patch(
        f"/api/v1/flashcards/{first_card.id}/weak", json={"is_weak": False}
    )
    bookmark = api_client.patch(
        f"/api/v1/flashcards/{second_card.id}/bookmark", json={"is_bookmarked": True}
    )
    unbookmark = api_client.patch(
        f"/api/v1/flashcards/{second_card.id}/bookmark", json={"is_bookmarked": False}
    )

    assert mark_weak.status_code == 200
    assert mark_weak.json()["is_weak"] is True
    assert unmark_weak.status_code == 200
    assert unmark_weak.json()["is_weak"] is False
    assert bookmark.status_code == 200
    assert bookmark.json()["is_bookmarked"] is True
    assert unbookmark.status_code == 200
    assert unbookmark.json()["is_bookmarked"] is False
    assert db_session.get(Flashcard, first_card.id).is_weak is False
    assert db_session.get(Flashcard, second_card.id).is_bookmarked is False


def test_flashcard_flag_routes_reject_missing_unknown_and_invalid_payloads(
    api_client: TestClient, db_session: Session
) -> None:
    _, cards = get_first_sheet_and_cards(db_session)
    card_id = cards[0].id

    responses = [
        api_client.patch(f"/api/v1/flashcards/{card_id}/weak", json={}),
        api_client.patch(
            f"/api/v1/flashcards/{card_id}/weak", json={"is_bookmarked": True}
        ),
        api_client.patch(
            f"/api/v1/flashcards/{card_id}/bookmark", json={"is_bookmarked": "yes"}
        ),
    ]

    assert all(response.status_code == 422 for response in responses)


def test_flashcard_flag_routes_return_404_for_missing_card(api_client: TestClient) -> None:
    weak_response = api_client.patch("/api/v1/flashcards/999/weak", json={"is_weak": True})
    bookmark_response = api_client.patch(
        "/api/v1/flashcards/999/bookmark", json={"is_bookmarked": True}
    )

    assert weak_response.status_code == 404
    assert weak_response.json() == {"detail": "Flashcard not found."}
    assert bookmark_response.status_code == 404
    assert bookmark_response.json() == {"detail": "Flashcard not found."}
