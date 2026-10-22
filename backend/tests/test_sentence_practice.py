import json

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.core.config import settings
from app.core.security import create_access_token
from app.models import Flashcard, StudySheet, Workbook
from app.models.user import User
from app.models.writing_attempt import WritingAttempt
from app.models.writing_prompt import WritingPrompt
from app.models.writing_usage import WritingAIUsage
from app.services import sentence_practice, writing, writing_ai
from test_writing_feedback import valid_feedback


TASK = {
    "prompt_en": "Write one sentence about plans you are excited about this weekend.",
    "prompt_vi": "Viết một câu về kế hoạch bạn đang mong đợi vào cuối tuần này.",
    "idea": {"en": "Think about meeting a friend.", "vi": "Nghĩ về việc gặp một người bạn."},
    "frame": {"en": "I look forward to ___ this weekend.", "vi": "Tôi mong chờ ___ vào cuối tuần này."},
    "example": {"en": "I look forward to seeing my friends.", "vi": "Tôi mong được gặp bạn bè."},
}


@pytest.fixture
def vocabulary(db_session):
    book = Workbook(name="Everyday", original_filename="everyday.xlsx")
    sheet = StudySheet(name="Plans", position=1)
    card = Flashcard(position=1, phrase="look forward to", meaning="mong chờ", is_weak=True)
    sheet.flashcards.append(card)
    book.sheets.append(sheet)
    db_session.add(book)
    db_session.commit()
    return card


@pytest.fixture
def fake_tasks(monkeypatch):
    calls = []

    def fake(**kwargs):
        calls.append(kwargs)
        return json.dumps(TASK, ensure_ascii=False)

    monkeypatch.setattr(sentence_practice, "call_9router_chat", fake)
    return calls


def create(api_client, headers, card_id):
    response = api_client.post("/api/v1/writing/attempts/sentence", headers=headers, json={"flashcard_id": card_id})
    assert response.status_code == 201, response.text
    return response.json()


def other_user(db, *, admin=True):
    existing = db.scalar(select(User))
    user = User(email="other-sentence@example.com", username="other_sentence", hashed_password=existing.hashed_password,
                is_active=True, is_superuser=admin)
    db.add(user)
    db.commit()
    return {"Authorization": f"Bearer {create_access_token(subject=user.id)}"}


def test_generation_freezes_source_and_private_task(api_client, db_session, admin_headers, vocabulary, fake_tasks):
    attempt = create(api_client, admin_headers, vocabulary.id)
    snapshot = attempt["prompt_snapshot"]
    context = snapshot["paragraph_hints"]["sentence_practice"]
    assert context["phrase"] == vocabulary.phrase
    assert context["flashcard_id"] == vocabulary.id
    assert context["frame"]["vi"] and context["example"]["en"]
    assert snapshot["format"] == "sentence" and attempt["draft_text"] == ""
    assert db_session.get(WritingPrompt, attempt["prompt_id"]).is_active is False
    assert api_client.get("/api/v1/writing/prompts", headers=admin_headers).json()["items"] == []
    # Không có revision gốc thì không thể tạo bài từ một prompt ẩn bằng ID đoán được.
    assert api_client.post("/api/v1/writing/attempts", headers=admin_headers,
                           json={"prompt_id": attempt["prompt_id"]}).status_code == 404
    usage = db_session.scalar(select(WritingAIUsage))
    assert usage.topic_generation_count == 1 and usage.used_count == 0
    assert fake_tasks[0]["json_output"] is True
    vocabulary.phrase = "changed source"
    db_session.commit()
    saved = api_client.get(f"/api/v1/writing/attempts/{attempt['id']}", headers=admin_headers).json()
    assert saved["prompt_snapshot"]["paragraph_hints"]["sentence_practice"]["phrase"] == "look forward to"


@pytest.mark.parametrize("authenticated", [False, True])
def test_sentence_endpoint_requires_admin(api_client, db_session, admin_headers, vocabulary, fake_tasks, authenticated):
    headers = other_user(db_session, admin=False) if authenticated else {}
    response = api_client.post("/api/v1/writing/attempts/sentence", headers=headers, json={"flashcard_id": vocabulary.id})
    assert response.status_code == (403 if authenticated else 401)
    assert not fake_tasks and db_session.scalar(select(WritingAttempt.id)) is None


def test_missing_or_invalid_card_does_not_consume_quota(api_client, db_session, admin_headers, vocabulary, fake_tasks):
    assert api_client.post("/api/v1/writing/attempts/sentence", headers=admin_headers, json={"flashcard_id": 99999}).status_code == 404
    vocabulary.phrase = " "
    db_session.commit()
    assert api_client.post("/api/v1/writing/attempts/sentence", headers=admin_headers, json={"flashcard_id": vocabulary.id}).status_code == 422
    assert not fake_tasks and db_session.scalar(select(WritingAIUsage.id)) is None


@pytest.mark.parametrize("raw", ["not JSON", "{}", json.dumps({**TASK, "idea": {"en": " ", "vi": " "}})])
def test_invalid_task_does_not_save_partial_attempt(api_client, db_session, admin_headers, vocabulary, monkeypatch, raw):
    monkeypatch.setattr(sentence_practice, "call_9router_chat", lambda **_: raw)
    result = api_client.post("/api/v1/writing/attempts/sentence", headers=admin_headers, json={"flashcard_id": vocabulary.id})
    assert result.status_code == 502
    assert db_session.scalar(select(WritingAttempt.id)) is None
    assert db_session.scalar(select(WritingPrompt.id)) is None
    assert db_session.scalar(select(WritingAIUsage)).topic_generation_count == 1


@pytest.mark.parametrize("code", [429, 503, 504])
def test_provider_errors_leave_generation_retryable(api_client, db_session, admin_headers, vocabulary, monkeypatch, code):
    def fail(**_):
        raise HTTPException(status_code=code, detail="AI provider is unavailable.")
    monkeypatch.setattr(sentence_practice, "call_9router_chat", fail)
    result = api_client.post("/api/v1/writing/attempts/sentence", headers=admin_headers, json={"flashcard_id": vocabulary.id})
    assert result.status_code == code
    assert db_session.scalar(select(WritingAttempt.id)) is None


def test_generation_uses_shared_quota(api_client, db_session, admin_headers, vocabulary, fake_tasks, monkeypatch):
    monkeypatch.setattr(settings, "writing_topic_generation_daily_quota", 1)
    create(api_client, admin_headers, vocabulary.id)
    assert api_client.post("/api/v1/writing/attempts/sentence", headers=admin_headers,
                           json={"flashcard_id": vocabulary.id}).status_code == 429
    assert len(fake_tasks) == 1


def test_sentence_lifecycle_rewrite_and_source_deletion(api_client, db_session, admin_headers, vocabulary, fake_tasks, monkeypatch):
    attempt = create(api_client, admin_headers, vocabulary.id)
    sentence = "I look forward to meet my friends."
    issue = valid_feedback()["issues"][0]
    issue.update(quote="meet", replacement="meeting")
    monkeypatch.setattr(writing, "grade_writing", lambda *_: (valid_feedback(issues=[issue]), "test-model"))
    base = f"/api/v1/writing/attempts/{attempt['id']}"
    saved = api_client.patch(base, headers=admin_headers, json={"version": 1, "draft_text": sentence}).json()
    graded = api_client.post(base + "/grade", headers=admin_headers, json={"version": saved["version"]})
    assert graded.status_code == 200, graded.text
    assert graded.json()["feedback"]["corrected_text"] == "I look forward to meeting my friends."
    assert graded.json()["feedback"]["issues"][0]["start"] == sentence.index("meet")
    assert db_session.get(Flashcard, vocabulary.id).is_weak is True
    assert db_session.get(Flashcard, vocabulary.id).correct_count == 0
    assert db_session.scalar(select(WritingAIUsage)).used_count == 1

    headers = other_user(db_session)
    for method, path, payload in [
        ("GET", base, None), ("PATCH", base, {"version": 1, "draft_text": "Bad access"}),
        ("POST", base + "/grade", {"version": 1}),
        ("POST", "/api/v1/writing/attempts", {"prompt_id": attempt["prompt_id"], "revision_of_id": attempt["id"]}),
    ]:
        assert api_client.request(method, path, headers=headers, json=payload).status_code == 404
    assert api_client.get("/api/v1/writing/attempts", headers=headers).json()["total"] == 0

    db_session.delete(vocabulary)
    db_session.commit()
    rewrite = api_client.post("/api/v1/writing/attempts", headers=admin_headers,
                              json={"prompt_id": attempt["prompt_id"], "revision_of_id": attempt["id"]})
    assert rewrite.status_code == 201, rewrite.text
    assert rewrite.json()["draft_text"] == "" and rewrite.json()["revision_of_id"] == attempt["id"]
    assert rewrite.json()["prompt_snapshot"] == attempt["prompt_snapshot"]
    rid = rewrite.json()["id"]
    saved = api_client.patch(f"/api/v1/writing/attempts/{rid}", headers=admin_headers, json={"version": 1, "draft_text": sentence}).json()
    same = api_client.post(f"/api/v1/writing/attempts/{rid}/grade", headers=admin_headers, json={"version": saved["version"]})
    assert same.status_code == 422
    assert db_session.scalar(select(WritingAIUsage)).used_count == 1
    revised_text = "I look forward to meeting my friends."
    monkeypatch.setattr(writing, "grade_writing", lambda *_: (valid_feedback(issues=[]), "test-model"))
    revised = api_client.patch(f"/api/v1/writing/attempts/{rid}", headers=admin_headers,
                               json={"version": saved["version"], "draft_text": revised_text}).json()
    result = api_client.post(f"/api/v1/writing/attempts/{rid}/grade", headers=admin_headers,
                             json={"version": revised["version"]})
    assert result.status_code == 200, result.text
    assert result.json()["feedback"]["corrected_text"] == revised_text
    assert db_session.scalar(select(WritingAIUsage)).used_count == 2
    history = api_client.get("/api/v1/writing/attempts", headers=admin_headers).json()
    assert history["total"] == 2 and history["items"][0]["revision_of_id"] == attempt["id"]
    assert api_client.get(base, headers=admin_headers).json()["submitted_text"] == sentence


@pytest.mark.parametrize("text", ["a" * 601, "word " * 61])
def test_sentence_limits_are_enforced_server_side(api_client, admin_headers, vocabulary, fake_tasks, text):
    attempt = create(api_client, admin_headers, vocabulary.id)
    result = api_client.patch(f"/api/v1/writing/attempts/{attempt['id']}", headers=admin_headers,
                              json={"version": 1, "draft_text": text})
    assert result.status_code == 422


def test_sentence_grader_receives_target_and_allows_alternative_answers(monkeypatch):
    captured = []
    monkeypatch.setattr(writing_ai, "call_9router_chat", lambda **kwargs: captured.append(kwargs) or json.dumps(valid_feedback(issues=[])))
    writing_ai.grade_writing({"prompt_en": TASK["prompt_en"], "prompt_vi": TASK["prompt_vi"], "format": "sentence",
                             "difficulty": "basic", "target_word_count": 15,
                             "paragraph_hints": {"sentence_practice": {"phrase": "look forward to", "meaning": "mong chờ"}}},
                            "She looks forward to visiting her parents.")
    assert "Accept valid inflections" in captured[0]["messages"][0]["content"]
    assert json.loads(captured[0]["messages"][1]["content"])["assignment"]["sentence_target"]["phrase"] == "look forward to"
