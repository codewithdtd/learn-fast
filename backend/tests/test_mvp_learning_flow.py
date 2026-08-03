from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import SheetStatus, StudySheet


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SAMPLE_WORKBOOK = PROJECT_ROOT / "samples" / "english-srs-sample.xlsx"
XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def answer_all_cards_and_complete(api_client: TestClient, session_id: int, cards: list[dict]) -> dict:
    for card in cards:
        answer = api_client.post(
            f"/api/v1/study-sessions/{session_id}/cards/{card['flashcard_id']}/answer",
            json={"direction": "en_to_vi", "result": "remembered"},
        )
        assert answer.status_code == 200

    completed = api_client.post(f"/api/v1/study-sessions/{session_id}/complete")
    assert completed.status_code == 200
    return completed.json()


def test_sample_workbook_can_complete_the_core_learning_loop(
    api_client: TestClient, db_session: Session
) -> None:
    with SAMPLE_WORKBOOK.open("rb") as source:
        imported = api_client.post(
            "/api/v1/workbooks/import",
            files={"file": (SAMPLE_WORKBOOK.name, source, XLSX_MIME_TYPE)},
        )

    assert imported.status_code == 201
    imported_sheets = imported.json()["sheets"]
    assert len(imported_sheets) == 2
    sheet_id = imported_sheets[0]["id"]
    cards = api_client.get(f"/api/v1/sheets/{sheet_id}/cards").json()
    assert len(cards) == 3

    bookmarked = api_client.patch(
        f"/api/v1/flashcards/{cards[0]['id']}/bookmark",
        json={"is_bookmarked": True},
    )
    quick_recall = api_client.post(
        f"/api/v1/sheets/{sheet_id}/quick-recall/complete",
        json={
            "results": [
                {"flashcard_id": cards[0]["id"], "result": "remembered"},
                {"flashcard_id": cards[1]["id"], "result": "need_review"},
                {"flashcard_id": cards[2]["id"], "result": "remembered"},
            ]
        },
    )

    assert bookmarked.status_code == 200
    assert quick_recall.status_code == 200
    assert quick_recall.json()["need_review_count"] == 1

    weak_session = api_client.post(
        "/api/v1/study-sessions",
        json={"sheet_id": sheet_id, "session_type": "weak_cards", "direction": "en_to_vi"},
    )
    assert weak_session.status_code == 201
    weak_completed = answer_all_cards_and_complete(
        api_client,
        weak_session.json()["id"],
        weak_session.json()["session_cards"],
    )
    weak_rating = api_client.post(
        f"/api/v1/study-sessions/{weak_completed['id']}/rating",
        json={"rating": "good"},
    )
    assert weak_rating.status_code == 422

    full_session = api_client.post(
        "/api/v1/study-sessions",
        json={"sheet_id": sheet_id, "session_type": "new_learning", "direction": "en_to_vi"},
    )
    assert full_session.status_code == 201
    full_cards = full_session.json()["session_cards"]
    first_again = api_client.post(
        f"/api/v1/study-sessions/{full_session.json()['id']}/cards/{full_cards[0]['flashcard_id']}/answer",
        json={"direction": "en_to_vi", "result": "again"},
    )
    assert first_again.status_code == 200
    full_completed = answer_all_cards_and_complete(api_client, full_session.json()["id"], full_cards)
    rated = api_client.post(
        f"/api/v1/study-sessions/{full_completed['id']}/rating",
        json={"rating": "good"},
    )

    assert rated.status_code == 200
    assert rated.json()["sheet"]["status"] == "learned"
    assert rated.json()["sheet"]["srs_level"] == 1
    assert rated.json()["sheet"]["interval_days"] == 1

    sheet = db_session.get(StudySheet, sheet_id)
    sheet.status = SheetStatus.LEARNED
    sheet.next_review_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()
    dashboard = api_client.get("/api/v1/dashboard")

    assert dashboard.status_code == 200
    assert [item["id"] for item in dashboard.json()["due_sheets"]] == [sheet_id]

    review_session = api_client.post(
        "/api/v1/study-sessions",
        json={"sheet_id": sheet_id, "session_type": "srs_review", "direction": "en_to_vi"},
    )
    assert review_session.status_code == 201
    review_completed = answer_all_cards_and_complete(
        api_client,
        review_session.json()["id"],
        review_session.json()["session_cards"],
    )
    review_rated = api_client.post(
        f"/api/v1/study-sessions/{review_completed['id']}/rating",
        json={"rating": "good"},
    )
    final_dashboard = api_client.get("/api/v1/dashboard")

    assert review_rated.status_code == 200
    assert review_rated.json()["sheet"]["srs_level"] == 2
    assert review_rated.json()["sheet"]["interval_days"] == 3
    assert final_dashboard.status_code == 200
    assert sheet_id not in [item["id"] for item in final_dashboard.json()["due_sheets"]]
