import json
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import create_access_token, get_password_hash
from app.models.user import User
from app.models.writing_attempt import WritingAttempt
from app.models.writing_usage import WritingAIUsage
from app.services import writing as writing_service
from scripts.seed_writing_prompts import seed_writing_prompts


def make_user(db_session, suffix: str = "learner", *, is_admin: bool = True) -> tuple[User, dict[str, str]]:
    user = User(
        email=f"{suffix}@example.com",
        username=suffix,
        hashed_password=get_password_hash("WritingPass123"),
        is_active=True,
        is_superuser=is_admin,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(subject=user.id)
    return user, {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def prompt_seed(db_session):
    assert seed_writing_prompts(db_session) == 10


def test_prompt_catalog_has_bilingual_hints_and_daily_suggestion(api_client: TestClient, admin_headers) -> None:
    response = api_client.get("/api/v1/writing/prompts", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 10
    assert body["suggested_prompt_id"] is not None
    assert all(item["sentence_hints"][0]["idea_vi"] for item in body["items"])


def test_attempt_creation_requires_authentication(api_client: TestClient) -> None:
    assert api_client.post("/api/v1/writing/attempts", json={"prompt_id": 1}).status_code == 401


@pytest.mark.parametrize("authenticated", [False, True])
@pytest.mark.parametrize("method,path,payload", [
    ("GET", "/prompts", None),
    ("GET", "/prompts/1", None),
    ("GET", "/usage", None),
    ("GET", "/attempts", None),
    ("GET", "/attempts/1", None),
    ("POST", "/attempts", {"prompt_id": 1}),
    ("POST", "/attempts/random", None),
    ("PATCH", "/attempts/1", {"version": 1, "draft_text": "A draft."}),
    ("POST", "/attempts/1/grade", {"version": 1}),
])
def test_all_writing_endpoints_reject_guests_and_non_admins(
    api_client, db_session, monkeypatch, authenticated, method, path, payload
):
    _, headers = make_user(db_session, "member", is_admin=False)
    monkeypatch.setattr(writing_service, "grade_writing", lambda *_: pytest.fail("AI called without admin rights"))
    monkeypatch.setattr(writing_service, "generate_writing_prompt", lambda: pytest.fail("AI called without admin rights"))
    response = api_client.request(method, "/api/v1/writing" + path,
                                  headers=headers if authenticated else {}, json=payload)
    assert response.status_code == (403 if authenticated else 401)
    if authenticated:
        assert "Administrator" in response.json()["detail"]
    assert db_session.scalar(select(WritingAttempt.id)) is None
    assert db_session.scalar(select(WritingAIUsage.id)) is None


def test_draft_save_uses_version_and_private_owner_scope(api_client: TestClient, db_session) -> None:
    owner, owner_headers = make_user(db_session, "owner")
    other, other_headers = make_user(db_session, "other")
    created = api_client.post("/api/v1/writing/attempts", headers=owner_headers, json={"prompt_id": 1})
    assert created.status_code == 201
    attempt_id = created.json()["id"]

    saved = api_client.patch(
        f"/api/v1/writing/attempts/{attempt_id}",
        headers=owner_headers,
        json={"version": 1, "draft_text": "I live in a small home."},
    )
    assert saved.status_code == 200
    assert saved.json()["version"] == 2
    assert saved.json()["word_count"] == 6
    assert api_client.get(f"/api/v1/writing/attempts/{attempt_id}", headers=other_headers).status_code == 404
    assert api_client.get("/api/v1/writing/attempts", headers=other_headers).json()["total"] == 0

    conflict = api_client.patch(
        f"/api/v1/writing/attempts/{attempt_id}",
        headers=owner_headers,
        json={"version": 1, "draft_text": "A stale tab."},
    )
    assert conflict.status_code == 409


def test_grading_persists_feedback_and_repeat_submit_does_not_call_ai_again(
    api_client: TestClient, db_session, monkeypatch
) -> None:
    owner, headers = make_user(db_session, "grader")
    created = api_client.post("/api/v1/writing/attempts", headers=headers, json={"prompt_id": 1}).json()
    saved = api_client.patch(
        f"/api/v1/writing/attempts/{created['id']}",
        headers=headers,
        json={"version": 1, "draft_text": "I lives in a small home."},
    ).json()
    calls = 0

    def fake_grade(_prompt, _essay):
        nonlocal calls
        calls += 1
        from test_writing_feedback import valid_feedback

        return valid_feedback(), "test-model"

    monkeypatch.setattr(writing_service, "grade_writing", fake_grade)
    graded = api_client.post(
        f"/api/v1/writing/attempts/{created['id']}/grade",
        headers=headers,
        json={"version": saved["version"]},
    )
    assert graded.status_code == 200, graded.text
    result = graded.json()
    assert result["status"] == "graded"
    assert result["feedback"]["practice_score"] == 7.5
    assert result["feedback"]["corrected_text"] == "I live in a small home."

    repeated = api_client.post(
        f"/api/v1/writing/attempts/{created['id']}/grade",
        headers=headers,
        json={"version": result["version"]},
    )
    assert repeated.status_code == 200
    assert calls == 1
    usage = db_session.scalar(select(WritingAIUsage).where(WritingAIUsage.user_id == owner.id))
    assert usage is not None and usage.used_count == 1


def test_failed_ai_call_saves_retryable_state_and_consumes_usage(
    api_client: TestClient, db_session, monkeypatch
) -> None:
    _owner, headers = make_user(db_session, "failed")
    created = api_client.post("/api/v1/writing/attempts", headers=headers, json={"prompt_id": 1}).json()
    saved = api_client.patch(
        f"/api/v1/writing/attempts/{created['id']}",
        headers=headers,
        json={"version": 1, "draft_text": "I like my home."},
    ).json()

    def fail(_prompt, _essay):
        from fastapi import HTTPException

        raise HTTPException(status_code=503, detail="AI is unavailable.")

    monkeypatch.setattr(writing_service, "grade_writing", fail)
    response = api_client.post(
        f"/api/v1/writing/attempts/{created['id']}/grade",
        headers=headers,
        json={"version": saved["version"]},
    )
    assert response.status_code == 503
    attempt = db_session.get(WritingAttempt, created["id"])
    assert attempt is not None and attempt.status == "failed"
    assert attempt.draft_text == "I like my home."
    usage = db_session.scalar(select(WritingAIUsage).where(WritingAIUsage.user_id == _owner.id))
    assert usage is not None and usage.used_count == 1


def test_daily_quota_blocks_provider_before_another_call(api_client: TestClient, db_session, monkeypatch):
    from zoneinfo import ZoneInfo

    from app.core.config import settings

    _owner, headers = make_user(db_session, "quota")
    created = api_client.post("/api/v1/writing/attempts", headers=headers, json={"prompt_id": 1}).json()
    saved = api_client.patch(
        f"/api/v1/writing/attempts/{created['id']}", headers=headers,
        json={"version": 1, "draft_text": "I enjoy my home."},
    ).json()
    monkeypatch.setattr(settings, "writing_daily_ai_quota", 1)
    monkeypatch.setattr(writing_service, "grade_writing", lambda *_: (_ for _ in ()).throw(AssertionError("provider called")))

    # Consume the single daily call through a valid first attempt, then verify a second attempt is rejected.
    other = api_client.post("/api/v1/writing/attempts", headers=headers, json={"prompt_id": 2}).json()
    other_saved = api_client.patch(
        f"/api/v1/writing/attempts/{other['id']}", headers=headers,
        json={"version": 1, "draft_text": "I study every day."},
    ).json()
    usage_date = datetime.now(ZoneInfo(settings.writing_timezone)).date()
    db_session.add(WritingAIUsage(user_id=_owner.id, usage_date=usage_date, used_count=1))
    db_session.commit()
    response = api_client.post(
        f"/api/v1/writing/attempts/{other['id']}/grade", headers=headers,
        json={"version": other_saved["version"]},
    )
    assert response.status_code == 429
    assert saved["draft_text"] == "I enjoy my home."


def test_invalid_feedback_gets_one_repair_call_and_charges_both_calls(
    api_client: TestClient, db_session, monkeypatch
):
    from test_writing_feedback import valid_feedback

    owner, headers = make_user(db_session, "repair")
    created = api_client.post("/api/v1/writing/attempts", headers=headers, json={"prompt_id": 1}).json()
    saved = api_client.patch(
        f"/api/v1/writing/attempts/{created['id']}", headers=headers,
        json={"version": 1, "draft_text": "I lives in a small home."},
    ).json()
    invalid_feedback = valid_feedback()
    invalid_feedback["issues"][0]["quote"] = "missing phrase"
    repaired_feedback = valid_feedback()
    monkeypatch.setattr(writing_service, "grade_writing", lambda *_: (invalid_feedback, "test-model"))
    monkeypatch.setattr(writing_service, "call_9router_chat", lambda **_kwargs: json.dumps(repaired_feedback))

    response = api_client.post(
        f"/api/v1/writing/attempts/{created['id']}/grade", headers=headers,
        json={"version": saved["version"]},
    )
    assert response.status_code == 200, response.text
    usage = db_session.scalar(select(WritingAIUsage).where(WritingAIUsage.user_id == owner.id))
    assert usage is not None and usage.used_count == 2


def test_rewrite_creates_linked_attempt_without_changing_original(api_client: TestClient, db_session):
    _owner, headers = make_user(db_session, "rewrite")
    first = api_client.post("/api/v1/writing/attempts", headers=headers, json={"prompt_id": 1}).json()
    row = db_session.get(WritingAttempt, first["id"])
    assert row is not None
    row.status = "graded"
    row.feedback_json = None
    db_session.commit()
    rewritten = api_client.post(
        "/api/v1/writing/attempts", headers=headers,
        json={"prompt_id": 1, "revision_of_id": first["id"]},
    )
    assert rewritten.status_code == 201
    assert rewritten.json()["revision_of_id"] == first["id"]
    assert db_session.get(WritingAttempt, first["id"]).status == "graded"


def test_demo_mode_blocks_attempt_mutations(api_client: TestClient, db_session, monkeypatch):
    from app.core.config import settings

    _owner, headers = make_user(db_session, "demo")
    monkeypatch.setattr(settings, "demo_mode", True)
    response = api_client.post("/api/v1/writing/attempts", headers=headers, json={"prompt_id": 1})
    assert response.status_code == 403


def test_read_recovers_interrupted_grading_and_rejects_late_result(api_client, db_session, monkeypatch):
    from app.core.config import settings
    from app.repositories.writing import WritingRepository

    monkeypatch.setattr(settings, "writing_grading_timeout", 90)
    owner, headers = make_user(db_session, "interrupted")
    created = api_client.post("/api/v1/writing/attempts", headers=headers, json={"prompt_id": 1}).json()
    attempt = db_session.get(WritingAttempt, created["id"])
    attempt.status = "grading"
    attempt.grading_started_at = datetime.now(timezone.utc) - timedelta(seconds=241)
    attempt.grading_token = "abandoned-worker"
    attempt.draft_text = attempt.submitted_text = "My saved paragraph."
    db_session.commit()

    recovered = api_client.get(f"/api/v1/writing/attempts/{attempt.id}", headers=headers)
    assert recovered.status_code == 200
    body = recovered.json()
    assert body["status"] == "failed"
    assert body["error_code"] == "grading_timeout"
    assert body["draft_text"] == body["submitted_text"] == "My saved paragraph."
    assert body["grading_expires_at"] is None
    assert body["version"] == created["version"] + 1

    late_saved = WritingRepository(db_session).complete_grading(
        attempt.id, owner.id, "abandoned-worker", {"rubric_version": "basic-v1"},
        9, "late-model", datetime.now(timezone.utc),
    )
    assert late_saved is False
    again = api_client.get(f"/api/v1/writing/attempts/{attempt.id}", headers=headers).json()
    assert again["status"] == "failed"
    assert again["version"] == body["version"]


def test_read_keeps_grading_active_during_valid_repair_window(api_client, db_session, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "writing_grading_timeout", 90)
    _, headers = make_user(db_session, "repair_window")
    created = api_client.post("/api/v1/writing/attempts", headers=headers, json={"prompt_id": 1}).json()
    attempt = db_session.get(WritingAttempt, created["id"])
    attempt.status = "grading"
    attempt.grading_started_at = datetime.now(timezone.utc) - timedelta(seconds=160)
    db_session.commit()
    response = api_client.get(f"/api/v1/writing/attempts/{attempt.id}", headers=headers).json()
    assert response["status"] == "grading"
    assert response["grading_expires_at"] is not None
    assert response["version"] == created["version"]


def test_recovery_is_owner_scoped_and_history_recovers_missing_timestamp(api_client, db_session):
    _, owner_headers = make_user(db_session, "recovery_owner")
    _, other_headers = make_user(db_session, "recovery_other")
    created = api_client.post("/api/v1/writing/attempts", headers=owner_headers, json={"prompt_id": 1}).json()
    attempt = db_session.get(WritingAttempt, created["id"])
    attempt.status = "grading"
    attempt.grading_started_at = None
    db_session.commit()
    assert api_client.get(f"/api/v1/writing/attempts/{attempt.id}", headers=other_headers).status_code == 404
    assert api_client.get("/api/v1/writing/attempts", headers=other_headers).json()["items"] == []
    db_session.refresh(attempt)
    assert attempt.status == "grading"
    history = api_client.get("/api/v1/writing/attempts", headers=owner_headers).json()
    assert history["items"][0]["status"] == "failed"


def test_failed_draft_edits_are_saved_before_retrying_feedback(api_client, db_session, monkeypatch):
    from test_writing_feedback import valid_feedback

    _, headers = make_user(db_session, "retry_edit")
    created = api_client.post("/api/v1/writing/attempts", headers=headers, json={"prompt_id": 1}).json()
    attempt = db_session.get(WritingAttempt, created["id"])
    attempt.status = "failed"
    attempt.error_code = "grading_timeout"
    attempt.draft_text = "An older draft."
    db_session.commit()
    edited = api_client.patch(
        f"/api/v1/writing/attempts/{attempt.id}", headers=headers,
        json={"version": created["version"], "draft_text": "I lives in a small home."},
    )
    assert edited.status_code == 200
    assert edited.json()["status"] == "draft"
    assert edited.json()["error_code"] is None
    received = []

    def grade(_prompt, essay):
        received.append(essay)
        return valid_feedback(), "test-model"

    monkeypatch.setattr(writing_service, "grade_writing", grade)
    result = api_client.post(
        f"/api/v1/writing/attempts/{attempt.id}/grade", headers=headers,
        json={"version": edited.json()["version"]},
    )
    assert result.status_code == 200
    assert received == ["I lives in a small home."]
    assert result.json()["feedback"]["corrected_text"] == "I live in a small home."


@pytest.mark.parametrize("repair_valid", [True, False])
def test_invalid_json_repair_always_persists_a_terminal_state(api_client, db_session, monkeypatch, repair_valid):
    from app.services.writing_ai import InvalidAIJSON
    from test_writing_feedback import valid_feedback

    owner, headers = make_user(db_session, "json_repair")
    created = api_client.post("/api/v1/writing/attempts", headers=headers, json={"prompt_id": 1}).json()
    saved = api_client.patch(
        f"/api/v1/writing/attempts/{created['id']}", headers=headers,
        json={"version": 1, "draft_text": "I lives in a small home."},
    ).json()

    def malformed(_prompt, _essay):
        raise InvalidAIJSON("Extra data", '{"invalid":true}{"extra":true}')

    monkeypatch.setattr(writing_service, "grade_writing", malformed)
    monkeypatch.setattr(writing_service, "call_9router_chat", lambda **_: (
        json.dumps(valid_feedback()) if repair_valid else "not JSON"
    ))
    result = api_client.post(
        f"/api/v1/writing/attempts/{created['id']}/grade", headers=headers,
        json={"version": saved["version"]},
    )
    assert result.status_code == (200 if repair_valid else 502)
    persisted = api_client.get(f"/api/v1/writing/attempts/{created['id']}", headers=headers).json()
    assert persisted["status"] == ("graded" if repair_valid else "failed")
    assert persisted["draft_text"] == "I lives in a small home."
    if repair_valid:
        assert persisted["feedback"]["corrected_text"] == "I live in a small home."
        assert db_session.get(WritingAttempt, created["id"]).model_name
    usage = db_session.scalar(select(WritingAIUsage).where(WritingAIUsage.user_id == owner.id))
    assert usage.used_count == 2
