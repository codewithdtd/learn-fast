import json

import pytest
from sqlalchemy import select

from app.core.security import create_access_token
from app.models import Flashcard, StudySheet, Workbook
from app.models.user import User
from app.models.writing_attempt import WritingAttempt
from app.models.writing_usage import WritingAIUsage
from app.services import paragraph_practice, writing
from test_writing_feedback import valid_feedback


@pytest.fixture
def practice_sheet(db_session, admin_headers):
    admin = db_session.scalar(select(User).where(User.is_superuser.is_(True)))
    book = Workbook(name="Practice", original_filename="practice.xlsx", user_id=admin.id)
    sheet = StudySheet(name="Phrases", position=1)
    sheet.flashcards = [Flashcard(position=i, phrase=f"phrase {i}", meaning=f"nghĩa số {i}") for i in range(1, 7)]
    book.sheets.append(sheet)
    db_session.add(book)
    db_session.commit()
    return sheet


@pytest.fixture
def fake_task(monkeypatch):
    def fake(**kwargs):
        words = json.loads(kwargs["messages"][1]["content"])["vocabulary_untrusted"]
        paragraph = "Đây là một ngày thú vị. " + ", ".join(word["meaning"] for word in words) + "."
        return json.dumps({"title_en": "A day together", "title_vi": "Một ngày cùng nhau", "paragraph_vi": paragraph,
                           "word_uses": [{"id": word["id"], "vietnamese_excerpt": word["meaning"]} for word in words]}, ensure_ascii=False)
    monkeypatch.setattr(paragraph_practice, "call_9router_chat", fake)


def payload(sheet):
    return {"sheet_id": sheet.id, "card_ids": [card.id for card in sheet.flashcards[:5]], "style": "dialogue"}


def test_selection_validation_and_sheet_scope(api_client, db_session, admin_headers, practice_sheet, fake_task):
    url = "/api/v1/writing/attempts/vocabulary-paragraph"
    data = payload(practice_sheet)
    assert api_client.post(url, headers=admin_headers, json={**data, "card_ids": data["card_ids"][:4]}).status_code == 422
    assert api_client.post(url, headers=admin_headers, json={**data, "card_ids": data["card_ids"][:4] + data["card_ids"][:1]}).status_code == 422
    assert api_client.post(url, headers=admin_headers, json={**data, "card_ids": data["card_ids"][:4] + [999999]}).status_code == 422
    assert api_client.post(url, json=data).status_code == 401
    assert db_session.scalar(select(WritingAIUsage.id)) is None


def test_saved_attempt_feedback_and_error_history_are_private(api_client, db_session, admin_headers, practice_sheet, fake_task, monkeypatch):
    created = api_client.post("/api/v1/writing/attempts/vocabulary-paragraph", headers=admin_headers, json=payload(practice_sheet))
    assert created.status_code == 201, created.text
    attempt = created.json()
    context = attempt["prompt_snapshot"]["paragraph_hints"]["vocabulary_translation"]
    assert context["style"] == "dialogue" and len(context["words"]) == 5
    practice_sheet.flashcards[0].phrase = "changed later"
    db_session.commit()
    monkeypatch.setattr(writing, "grade_writing", lambda *_: (valid_feedback(), "fake"))
    base = f"/api/v1/writing/attempts/{attempt['id']}"
    saved = api_client.patch(base, headers=admin_headers, json={"version": 1, "draft_text": "I lives in a small home."}).json()
    graded = api_client.post(base + "/grade", headers=admin_headers, json={"version": saved["version"]})
    assert graded.status_code == 200, graded.text
    assert graded.json()["feedback"]["corrected_text"] == "I live in a small home."
    assert graded.json()["prompt_snapshot"]["paragraph_hints"]["vocabulary_translation"]["words"][0]["phrase"] == "phrase 1"
    history = api_client.get("/api/v1/writing/error-history", headers=admin_headers).json()
    assert history["items"][0]["issues"][0]["quote"] == "I lives"
    admin = db_session.scalar(select(User).where(User.is_superuser.is_(True)))
    other = User(username="paragraph_other", email="paragraph_other@example.com", hashed_password=admin.hashed_password, is_active=True)
    db_session.add(other); db_session.commit()
    headers = {"Authorization": f"Bearer {create_access_token(subject=other.id)}"}
    assert api_client.get(base, headers=headers).status_code == 404
    assert api_client.get("/api/v1/writing/error-history", headers=headers).json()["total"] == 0


def test_guest_trial_creates_no_writing_attempt(api_client, db_session, practice_sheet, fake_task, monkeypatch):
    from app.api import guest_ai
    monkeypatch.setattr(guest_ai, "grade_writing", lambda *_: (valid_feedback(), "fake"))
    headers = {"X-Guest-Token": "a" * 40}
    url = "/api/v1/guest/ai/vocabulary-paragraph/topic"
    response = api_client.post(url, headers=headers, json=payload(practice_sheet))
    assert response.status_code == 200, response.text
    task = response.json()
    assert api_client.post(url, headers=headers, json=payload(practice_sheet)).status_code == 429
    grade = api_client.post("/api/v1/guest/ai/vocabulary-paragraph/grade", headers=headers, json={"task": task, "draft_text": "I lives in a small home."})
    assert grade.status_code == 200, grade.text
    assert grade.json()["corrected_text"] == "I live in a small home."
    assert api_client.post("/api/v1/guest/ai/vocabulary-paragraph/grade", headers=headers, json={"task": task, "draft_text": "I lives in a small home."}).status_code == 429
    assert db_session.scalar(select(WritingAttempt.id)) is None


def test_invalid_ai_mapping_does_not_save_attempt(api_client, db_session, admin_headers, practice_sheet, monkeypatch):
    monkeypatch.setattr(paragraph_practice, "call_9router_chat", lambda **_: json.dumps({"title_en": "Example", "title_vi": "Ví dụ", "paragraph_vi": "Một câu chuyện dài hơn ba mươi ký tự ở đây.", "word_uses": [{"id": i, "vietnamese_excerpt": "absent"} for i in range(1, 6)]}))
    result = api_client.post("/api/v1/writing/attempts/vocabulary-paragraph", headers=admin_headers, json=payload(practice_sheet))
    assert result.status_code == 502
    assert db_session.scalar(select(WritingAttempt.id)) is None


def test_other_users_private_sheet_cannot_be_selected(api_client, db_session, admin_headers, practice_sheet, fake_task):
    admin = db_session.scalar(select(User).where(User.is_superuser.is_(True)))
    owner = User(username="private_owner", email="private_owner@example.com", hashed_password=admin.hashed_password, is_active=True)
    visitor = User(username="private_visitor", email="private_visitor@example.com", hashed_password=admin.hashed_password, is_active=True)
    db_session.add_all([owner, visitor]); db_session.flush()
    book = Workbook(name="Private", original_filename="private.xlsx", user_id=owner.id)
    sheet = StudySheet(name="Private words", position=1)
    sheet.flashcards = [Flashcard(position=i, phrase=f"private {i}", meaning=f"nghĩa riêng {i}") for i in range(1, 6)]
    book.sheets.append(sheet); db_session.add(book); db_session.commit()
    headers = {"Authorization": f"Bearer {create_access_token(subject=visitor.id)}"}
    assert api_client.post("/api/v1/writing/attempts/vocabulary-paragraph", headers=headers, json=payload(sheet)).status_code == 404
    assert api_client.post("/api/v1/guest/ai/vocabulary-paragraph/topic", headers={"X-Guest-Token": "b" * 40}, json=payload(sheet)).status_code == 404
    assert db_session.scalar(select(WritingAttempt.id)) is None
