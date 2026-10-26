from app.core.security import create_access_token
from app.models import User


def _headers_for_user(db_session, email: str) -> dict[str, str]:
    user = User(
        email=email,
        username=email.split("@", maxsplit=1)[0],
        hashed_password="not-used-by-this-test",
        is_active=True,
        is_superuser=False,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return {"Authorization": f"Bearer {create_access_token(subject=user.id)}"}


def test_guest_can_browse_sources_but_cannot_load_personal_sheets(api_client) -> None:
    sources = api_client.get("/api/v1/reading/sources")
    private_sheets = api_client.get("/api/v1/reading/vocabulary-sheets")

    assert sources.status_code == 200
    assert {source["id"] for source in sources.json()} == {"vnexpress", "vietnamnews"}
    assert private_sheets.status_code == 401


def test_vocabulary_is_saved_only_to_the_authenticated_owner(api_client, db_session) -> None:
    owner_headers = _headers_for_user(db_session, "reader-owner@example.com")
    other_headers = _headers_for_user(db_session, "reader-other@example.com")

    created_sheet = api_client.post("/api/v1/reading/vocabulary-sheets", headers=owner_headers)
    assert created_sheet.status_code == 201
    sheet = created_sheet.json()

    created_card = api_client.post(
        f"/api/v1/reading/vocabulary-sheets/{sheet['id']}/cards",
        headers=owner_headers,
        json={"phrase": "daily routine", "meaning": "thói quen hằng ngày"},
    )
    owner_sheets = api_client.get("/api/v1/reading/vocabulary-sheets", headers=owner_headers)
    other_sheets = api_client.get("/api/v1/reading/vocabulary-sheets", headers=other_headers)
    owner_workbook = api_client.get(f"/api/v1/workbooks/{sheet['workbook_id']}", headers=owner_headers)
    owner_sheet = api_client.get(f"/api/v1/sheets/{sheet['id']}", headers=owner_headers)
    owner_cards = api_client.get(f"/api/v1/sheets/{sheet['id']}/cards", headers=owner_headers)
    other_workbook = api_client.get(f"/api/v1/workbooks/{sheet['workbook_id']}", headers=other_headers)
    other_sheet = api_client.get(f"/api/v1/sheets/{sheet['id']}", headers=other_headers)
    other_write = api_client.post(
        f"/api/v1/reading/vocabulary-sheets/{sheet['id']}/cards",
        headers=other_headers,
        json={"phrase": "commute", "meaning": "đi lại"},
    )

    assert created_card.status_code == 201
    assert created_card.json()["phrase"] == "daily routine"
    assert owner_sheets.json()["sheets"][0]["card_count"] == 1
    assert other_sheets.json()["sheets"] == []
    assert owner_workbook.status_code == 200
    assert owner_sheet.status_code == 200
    assert len(owner_cards.json()) == 1
    assert other_workbook.status_code == 404
    assert other_sheet.status_code == 404
    assert other_write.status_code == 404
