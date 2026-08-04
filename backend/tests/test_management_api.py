from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Flashcard, StudySheet, Workbook


def create_workbook(db: Session, name: str, imported_at: datetime) -> Workbook:
    workbook = Workbook(
        name=name,
        original_filename=f"{name}.xlsx",
        sheet_count=2,
        total_cards=3,
        imported_at=imported_at,
    )
    second_sheet = StudySheet(name="Second", position=2, card_count=1)
    first_sheet = StudySheet(name="First", position=1, card_count=2)
    second_sheet.flashcards.append(Flashcard(position=1, phrase="second", meaning="thứ hai"))
    first_sheet.flashcards.extend(
        [
            Flashcard(position=2, phrase="two", meaning="hai"),
            Flashcard(position=1, phrase="one", meaning="một"),
        ]
    )
    # Append in reverse order to ensure API/model ordering relies on position,
    # not insertion order.
    workbook.sheets.extend([second_sheet, first_sheet])
    db.add(workbook)
    db.commit()
    return workbook


def test_list_workbooks_returns_empty_array(api_client: TestClient) -> None:
    response = api_client.get("/api/v1/workbooks")

    assert response.status_code == 200
    assert response.json() == []


def test_list_and_detail_order_workbook_content(api_client: TestClient, db_session: Session) -> None:
    now = datetime.now(timezone.utc)
    create_workbook(db_session, "Older", now - timedelta(days=1))
    newest = create_workbook(db_session, "Newest", now)

    list_response = api_client.get("/api/v1/workbooks")
    detail_response = api_client.get(f"/api/v1/workbooks/{newest.id}")

    assert [item["name"] for item in list_response.json()] == ["Newest", "Older"]
    detail = detail_response.json()
    assert detail["name"] == "Newest"
    assert [sheet["name"] for sheet in detail["sheets"]] == ["First", "Second"]
    assert [sheet["position"] for sheet in detail["sheets"]] == [1, 2]


def test_patch_workbook_name_persists_without_changing_sheets(
    api_client: TestClient, db_session: Session
) -> None:
    workbook = create_workbook(db_session, "Vocabulary", datetime.now(timezone.utc))

    response = api_client.patch(
        f"/api/v1/workbooks/{workbook.id}",
        json={"name": "  Daily vocabulary  "},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Daily vocabulary"
    assert [sheet["position"] for sheet in response.json()["sheets"]] == [1, 2]
    assert db_session.get(Workbook, workbook.id).name == "Daily vocabulary"


def test_patch_workbook_name_rejects_invalid_payloads(
    api_client: TestClient, db_session: Session
) -> None:
    workbook = create_workbook(db_session, "Vocabulary", datetime.now(timezone.utc))

    empty_name = api_client.patch(f"/api/v1/workbooks/{workbook.id}", json={"name": "   "})
    too_long = api_client.patch(f"/api/v1/workbooks/{workbook.id}", json={"name": "x" * 256})
    unknown_field = api_client.patch(
        f"/api/v1/workbooks/{workbook.id}", json={"name": "New name", "total_cards": 99}
    )

    assert empty_name.status_code == 422
    assert too_long.status_code == 422
    assert unknown_field.status_code == 422
    assert db_session.get(Workbook, workbook.id).name == "Vocabulary"


def test_sheet_detail_and_cards_keep_position_order(
    api_client: TestClient, db_session: Session
) -> None:
    workbook = create_workbook(db_session, "Vocabulary", datetime.now(timezone.utc))
    first_sheet_id = workbook.sheets[0].id

    sheet_response = api_client.get(f"/api/v1/sheets/{first_sheet_id}")
    cards_response = api_client.get(f"/api/v1/sheets/{first_sheet_id}/cards")

    assert sheet_response.status_code == 200
    assert sheet_response.json()["workbook"] == {"id": workbook.id, "name": "Vocabulary"}
    assert [card["phrase"] for card in cards_response.json()] == ["one", "two"]


def test_patch_sheet_priority_persists_and_rejects_invalid_payloads(
    api_client: TestClient, db_session: Session
) -> None:
    workbook = create_workbook(db_session, "Vocabulary", datetime.now(timezone.utc))
    sheet_id = workbook.sheets[0].id

    success = api_client.patch(f"/api/v1/sheets/{sheet_id}", json={"priority": "high"})
    empty_body = api_client.patch(f"/api/v1/sheets/{sheet_id}", json={})
    unknown_field = api_client.patch(
        f"/api/v1/sheets/{sheet_id}", json={"priority": "low", "status": "learned"}
    )

    assert success.status_code == 200
    assert success.json()["priority"] == "high"
    assert db_session.get(StudySheet, sheet_id).priority.value == "high"
    assert empty_body.status_code == 422
    assert unknown_field.status_code == 422


def test_patch_sheet_name_and_priority_persist_together(
    api_client: TestClient, db_session: Session
) -> None:
    workbook = create_workbook(db_session, "Vocabulary", datetime.now(timezone.utc))
    sheet_id = workbook.sheets[0].id

    response = api_client.patch(
        f"/api/v1/sheets/{sheet_id}",
        json={"name": "  Travel phrases  ", "priority": "high"},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Travel phrases"
    assert response.json()["priority"] == "high"
    updated_sheet = db_session.get(StudySheet, sheet_id)
    assert updated_sheet.name == "Travel phrases"
    assert updated_sheet.priority.value == "high"


def test_patch_sheet_name_rejects_invalid_payloads(
    api_client: TestClient, db_session: Session
) -> None:
    workbook = create_workbook(db_session, "Vocabulary", datetime.now(timezone.utc))
    sheet_id = workbook.sheets[0].id

    empty_name = api_client.patch(f"/api/v1/sheets/{sheet_id}", json={"name": "\t"})
    too_long = api_client.patch(f"/api/v1/sheets/{sheet_id}", json={"name": "x" * 256})

    assert empty_name.status_code == 422
    assert too_long.status_code == 422
    assert db_session.get(StudySheet, sheet_id).name == "First"


def test_not_found_resources_return_consistent_messages(api_client: TestClient) -> None:
    workbook_response = api_client.get("/api/v1/workbooks/999")
    sheet_response = api_client.get("/api/v1/sheets/999")
    cards_response = api_client.get("/api/v1/sheets/999/cards")

    assert workbook_response.status_code == 404
    assert workbook_response.json() == {"detail": "Workbook not found."}
    assert sheet_response.status_code == 404
    assert sheet_response.json() == {"detail": "Study sheet not found."}
    assert cards_response.status_code == 404
    assert cards_response.json() == {"detail": "Study sheet not found."}


def test_patch_rename_resources_return_not_found(api_client: TestClient) -> None:
    workbook_response = api_client.patch("/api/v1/workbooks/999", json={"name": "Missing"})
    sheet_response = api_client.patch("/api/v1/sheets/999", json={"name": "Missing"})

    assert workbook_response.status_code == 404
    assert workbook_response.json() == {"detail": "Workbook not found."}
    assert sheet_response.status_code == 404
    assert sheet_response.json() == {"detail": "Study sheet not found."}


def test_delete_workbook_removes_child_sheets_and_cards(
    api_client: TestClient, db_session: Session
) -> None:
    workbook = create_workbook(db_session, "Delete me", datetime.now(timezone.utc))

    response = api_client.delete(f"/api/v1/workbooks/{workbook.id}")

    assert response.status_code == 204
    assert db_session.scalar(select(func.count(Workbook.id))) == 0
    assert db_session.scalar(select(func.count(StudySheet.id))) == 0
    assert db_session.scalar(select(func.count(Flashcard.id))) == 0
    assert api_client.get(f"/api/v1/workbooks/{workbook.id}").status_code == 404


def test_patch_cors_preflight_allows_content_type(api_client: TestClient) -> None:
    response = api_client.options(
        "/api/v1/sheets/1",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "PATCH",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "PATCH" in response.headers["access-control-allow-methods"]
    assert "content-type" in response.headers["access-control-allow-headers"].lower()
