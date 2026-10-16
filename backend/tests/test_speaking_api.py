from sqlalchemy import select

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash
from app.models.speaking_attempt import SpeakingAttempt
from app.models.speaking_prompt import SpeakingPrompt
from app.models.speaking_usage import SpeakingAIUsage
from app.models.user import User
from app.schemas.speaking import SpeakingPromptDraft
from app.services import speaking as speaking_service
from app.services import speaking_ai


def _make_user(db_session, username: str, admin: bool) -> tuple[User, dict[str, str]]:
    user = User(
        email=f"{username}@example.com", username=username,
        hashed_password=get_password_hash("SpeakingPass123"), is_active=True, is_superuser=admin,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user, {"Authorization": f"Bearer {create_access_token(subject=user.id)}"}


def test_speaking_routes_are_admin_only(api_client, db_session, admin_headers):
    _, member_headers = _make_user(db_session, "speaking_member", False)
    assert api_client.get("/api/v1/speaking/prompts").status_code == 401
    assert api_client.get("/api/v1/speaking/prompts", headers=member_headers).status_code == 403
    response = api_client.get("/api/v1/speaking/prompts", headers=admin_headers)
    assert response.status_code == 200
    assert len(response.json()["items"]) == 8
    assert response.json()["items"][0]["hints"][0]["vi"]


def test_speaking_history_endpoint_works_after_speaking_migration(api_client, admin_headers):
    response = api_client.get("/api/v1/speaking/attempts", headers=admin_headers)

    assert response.status_code == 200, response.text
    assert response.json() == {"items": [], "total": 0}


def test_ai_generated_speaking_topic_is_saved_with_attempt(api_client, db_session, admin_headers, monkeypatch):
    generated = SpeakingPromptDraft(
        title_en="A place to relax", title_vi="Một nơi để thư giãn",
        question_en="Where do you like to go when you want to relax?",
        question_vi="Bạn thích đi đâu khi muốn thư giãn?",
        category="ielts_part1", hints=[
            {"en": "Name the place.", "vi": "Nêu tên địa điểm."},
            {"en": "Say what you do there.", "vi": "Nói bạn làm gì ở đó."},
            {"en": "Explain why you like it.", "vi": "Giải thích vì sao bạn thích nơi đó."},
        ],
    )
    monkeypatch.setattr(speaking_service, "generate_speaking_prompt", lambda: generated)
    _, member_headers = _make_user(db_session, "speaking_generate_member", False)

    assert api_client.post("/api/v1/speaking/attempts/random").status_code == 401
    assert api_client.post("/api/v1/speaking/attempts/random", headers=member_headers).status_code == 403
    response = api_client.post("/api/v1/speaking/attempts/random", headers=admin_headers)

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["prompt_snapshot"]["title_en"] == "A place to relax"
    assert len(data["prompt_snapshot"]["hints"]) == 3
    assert db_session.get(SpeakingPrompt, data["prompt_id"]).slug.startswith("ai-")
    assert db_session.get(SpeakingAttempt, data["id"]).prompt_snapshot["question_vi"] == "Bạn thích đi đâu khi muốn thư giãn?"


def test_ai_generated_speaking_topic_provider_failure_does_not_create_attempt(api_client, db_session, admin_headers, monkeypatch):
    def fail_generation():
        raise speaking_service.TranscriptionProviderError("Topic generation is temporarily unavailable.", 502)

    monkeypatch.setattr(speaking_service, "generate_speaking_prompt", fail_generation)
    response = api_client.post("/api/v1/speaking/attempts/random", headers=admin_headers)

    assert response.status_code == 502
    assert db_session.scalar(select(SpeakingAttempt)) is None


def test_attempt_is_private_to_its_owner(api_client, db_session, admin_headers):
    _, second_admin = _make_user(db_session, "speaking_second_admin", True)
    attempt = api_client.post("/api/v1/speaking/attempts", headers=admin_headers, json={"prompt_id": 1})
    assert attempt.status_code == 201
    response = api_client.get(f"/api/v1/speaking/attempts/{attempt.json()['id']}", headers=second_admin)
    assert response.status_code == 404


def test_transcription_validates_audio_and_consumes_quota_once(api_client, db_session, admin_headers, monkeypatch):
    monkeypatch.setattr(settings, "speaking_daily_ai_quota", 1)
    monkeypatch.setattr(speaking_service, "transcribe_audio", lambda audio, mime, name: "I live in a small apartment.")
    first = api_client.post("/api/v1/speaking/attempts", headers=admin_headers, json={"prompt_id": 1}).json()
    transcribed = api_client.post(
        f"/api/v1/speaking/attempts/{first['id']}/transcribe", headers=admin_headers,
        files={"audio": ("answer.webm", b"audio-bytes", "audio/webm")},
    )
    assert transcribed.status_code == 200, transcribed.text
    assert transcribed.json()["transcript"] == "I live in a small apartment."
    assert transcribed.json()["quota_consumed"] is True
    usage = db_session.scalar(select(SpeakingAIUsage))
    assert usage is not None and usage.used_count == 1
    second = api_client.post("/api/v1/speaking/attempts", headers=admin_headers, json={"prompt_id": 2}).json()
    blocked = api_client.post(
        f"/api/v1/speaking/attempts/{second['id']}/transcribe", headers=admin_headers,
        files={"audio": ("answer.webm", b"audio-bytes", "audio/webm")},
    )
    assert blocked.status_code == 429


def test_failed_provider_call_can_retry_without_second_quota(api_client, db_session, admin_headers, monkeypatch):
    monkeypatch.setattr(settings, "speaking_daily_ai_quota", 1)
    calls = 0

    def provider(*_args):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise speaking_service.TranscriptionProviderError("Provider unavailable.")
        return "I study English every day."

    monkeypatch.setattr(speaking_service, "transcribe_audio", provider)
    attempt = api_client.post("/api/v1/speaking/attempts", headers=admin_headers, json={"prompt_id": 1}).json()
    path = f"/api/v1/speaking/attempts/{attempt['id']}/transcribe"
    audio = {"audio": ("answer.webm", b"audio-bytes", "audio/webm")}
    assert api_client.post(path, headers=admin_headers, files=audio).status_code == 502
    succeeded = api_client.post(path, headers=admin_headers, files=audio)
    assert succeeded.status_code == 200, succeeded.text
    usage = db_session.scalar(select(SpeakingAIUsage))
    assert usage is not None and usage.used_count == 1


def test_transcript_edit_and_feedback_are_saved(api_client, db_session, admin_headers, monkeypatch):
    from app.schemas.speaking import SpeakingFeedback

    prompt = api_client.get("/api/v1/speaking/prompts", headers=admin_headers).json()["items"][0]
    attempt = api_client.post("/api/v1/speaking/attempts", headers=admin_headers, json={"prompt_id": prompt["id"]}).json()
    row = db_session.get(SpeakingAttempt, attempt["id"])
    assert row is not None
    row.transcript = "I live in a small flat near the city."
    row.status = "ready"
    row.version += 1
    db_session.commit()
    saved = api_client.patch(
        f"/api/v1/speaking/attempts/{row.id}", headers=admin_headers,
        json={"version": row.version, "transcript": "I live in a small flat near the city center."},
    )
    assert saved.status_code == 200, saved.text

    feedback = SpeakingFeedback.model_validate({
        "schema_version": "1",
        "relevance": {"score": 8, "feedback_en": "You answered the prompt.", "feedback_vi": "Bạn đã trả lời đúng chủ đề."},
        "coherence": {"score": 7, "feedback_en": "The idea is clear.", "feedback_vi": "Ý khá rõ ràng."},
        "vocabulary": {"score": 7, "feedback_en": "The words are appropriate.", "feedback_vi": "Từ vựng phù hợp."},
        "grammar": {"score": 8, "feedback_en": "Your sentence is correct.", "feedback_vi": "Câu của bạn đúng ngữ pháp."},
        "summary_en": "A clear short answer.", "summary_vi": "Một câu trả lời ngắn gọn, rõ ràng.",
        "strengths": [{"en": "You gave a specific detail.", "vi": "Bạn đưa ra chi tiết cụ thể."}],
        "improvements": [{"quote": "city center", "suggestion_en": "the city centre", "suggestion_vi": "the city centre", "reason_en": "Either spelling is acceptable.", "reason_vi": "Cả hai cách viết đều được chấp nhận."}],
        "next_steps": [{"en": "Add one reason.", "vi": "Thêm một lý do."}],
    })
    monkeypatch.setattr(speaking_service, "grade_speaking", lambda *_: (feedback, "test-model"))
    graded = api_client.post(
        f"/api/v1/speaking/attempts/{row.id}/grade", headers=admin_headers,
        json={"version": saved.json()["version"]},
    )
    assert graded.status_code == 200, graded.text
    assert graded.json()["feedback"]["grammar"]["score"] == 8
    assert api_client.get(f"/api/v1/speaking/attempts/{row.id}", headers=admin_headers).json()["status"] == "graded"


def test_gemini_transcription_uses_verbatim_and_deletes_uploaded_file(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(settings, "gemini_asr_model", "test-transcribe")
    calls: list[tuple[str, object]] = []

    class Response:
        def __init__(self, data=None, headers=None):
            self.data = data or {}
            self.headers = headers or {}

        def raise_for_status(self):
            return None

        def json(self):
            return self.data

    class Client:
        def __init__(self, **_kwargs):
            self.post_count = 0

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def post(self, url, **kwargs):
            calls.append((url, kwargs))
            self.post_count += 1
            if self.post_count == 1:
                return Response(headers={"x-goog-upload-url": "https://upload.example/file"})
            if self.post_count == 2:
                return Response({"file": {"name": "files/test-audio", "uri": "https://file.example/audio", "mimeType": "audio/webm"}})
            return Response({"output_text": "I enjoy reading in the evening."})

        def delete(self, url, **kwargs):
            calls.append(("DELETE " + url, kwargs))
            return Response()

    monkeypatch.setattr(speaking_ai.httpx, "Client", Client)
    transcript = speaking_ai.transcribe_audio(b"audio", "audio/webm", "attempt-1")
    assert transcript == "I enjoy reading in the evening."
    interaction = calls[2][1]["json"]
    assert interaction["generation_config"]["transcription_config"]["mode"] == "verbatim"
    assert calls[-1][0].endswith("/v1beta/files/test-audio")


def test_grading_rate_limit_is_reported_as_retryable(api_client, db_session, admin_headers, monkeypatch):
    attempt = api_client.post("/api/v1/speaking/attempts", headers=admin_headers, json={"prompt_id": 1}).json()
    row = db_session.get(SpeakingAttempt, attempt["id"])
    assert row is not None
    row.transcript = "I live in a small apartment."
    row.status = "ready"
    row.version += 1
    db_session.commit()

    def limited(*_args):
        raise speaking_service.TranscriptionProviderError("The feedback service is busy. Please try again shortly.", 429)

    monkeypatch.setattr(speaking_service, "grade_speaking", limited)
    response = api_client.post(
        f"/api/v1/speaking/attempts/{row.id}/grade", headers=admin_headers,
        json={"version": row.version},
    )
    assert response.status_code == 429
    assert "try again" in response.json()["detail"].lower()
    assert db_session.get(SpeakingAttempt, row.id).status == "failed"
