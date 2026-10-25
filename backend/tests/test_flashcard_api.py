import pytest
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Flashcard
from app.models import User, Workbook
from app.core.security import create_access_token, get_password_hash
from tests.test_management_api import create_workbook


@pytest.fixture(name="api_client")
def privileged_scenario_client(admin_api_client):
    """These learning/data scenarios now run with a verified administrator."""
    return admin_api_client

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


def test_admin_can_add_a_word_to_a_sheet_without_changing_srs_state(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, _ = get_first_sheet_and_cards(db_session)
    workbook = db_session.get(Workbook, sheet.workbook_id)
    old_total = workbook.total_cards

    response = api_client.post(
        f"/api/v1/sheets/{sheet.id}/cards",
        json={"phrase": "  look after  ", "meaning": "take care of", "example_en": "I look after my dog."},
    )

    assert response.status_code == 201
    card = response.json()
    assert card["phrase"] == "look after"
    assert card["position"] == 3
    assert card["is_weak"] is False
    assert card["is_bookmarked"] is False
    assert db_session.get(Flashcard, card["id"]).correct_count == 0
    db_session.refresh(sheet)
    db_session.refresh(workbook)
    assert sheet.card_count == 3
    assert workbook.total_cards == old_total + 1


def test_guest_and_non_admin_cannot_add_words_to_shared_sheets(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, _ = get_first_sheet_and_cards(db_session)
    user = User(
        email="reader_fixture@example.com",
        username="reader_fixture",
        hashed_password=get_password_hash("ReaderPass123"),
        is_active=True,
        is_superuser=False,
    )
    db_session.add(user)
    db_session.commit()
    token = create_access_token(subject=user.id)
    payload = {"phrase": "look after", "meaning": "take care of"}

    guest_response = api_client.post(
        f"/api/v1/sheets/{sheet.id}/cards", json=payload, headers={"Authorization": ""}
    )
    user_response = api_client.post(
        f"/api/v1/sheets/{sheet.id}/cards",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert guest_response.status_code == 401
    assert user_response.status_code == 403
    assert len(sheet.flashcards) == 2


def test_add_word_rejects_duplicates_invalid_data_and_missing_sheet(
    api_client: TestClient, db_session: Session
) -> None:
    sheet, _ = get_first_sheet_and_cards(db_session)
    duplicate = api_client.post(
        f"/api/v1/sheets/{sheet.id}/cards", json={"phrase": " ONE ", "meaning": "number 1"}
    )
    invalid = api_client.post(
        f"/api/v1/sheets/{sheet.id}/cards", json={"phrase": "  ", "meaning": "meaning"}
    )
    missing = api_client.post(
        "/api/v1/sheets/99999/cards", json={"phrase": "new word", "meaning": "meaning"}
    )

    assert duplicate.status_code == 409
    assert invalid.status_code == 422
    assert missing.status_code == 404
