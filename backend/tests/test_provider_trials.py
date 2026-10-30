from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from fastapi import HTTPException
import httpx
import pytest
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.models import User
from app.repositories.guest_ai_usage import GuestAIUsageRepository
from app.schemas.video_practice import TranscriptResponse, TranscriptSegment, WordLookupResponse
from app.schemas.reading import ReadingArticle, ReadingArticleContent, ReadingArticleList
from app.services.translation_provider import TranslationProviderError
from app.core.config import settings
from scripts.seed_writing_prompts import seed_writing_prompts
from test_writing_feedback import valid_feedback


def member_headers(db_session: Session) -> dict[str, str]:
    member = User(username="trial_member", email="trial@example.com", hashed_password="unused", is_active=True, is_superuser=False)
    db_session.add(member)
    db_session.commit()
    return {"Authorization": f"Bearer {create_access_token(subject=member.id)}"}


def transcript() -> TranscriptResponse:
    return TranscriptResponse(video_id="abcdefghijk", segments=[TranscriptSegment(start=0, duration=1, text="Hello")])


def test_translation_trial_is_shared_between_reading_and_video(api_client, db_session, monkeypatch):
    calls = []
    monkeypatch.setattr("app.api.reading.translate_english_to_vietnamese", lambda text: calls.append(text) or "xin chào")
    monkeypatch.setattr("app.api.video_practice.lookup_word", lambda term, context: calls.append(term) or WordLookupResponse(term=term, translation_vi="xin chào"))
    headers = member_headers(db_session)
    first = api_client.post("/api/v1/reading/lookup", headers=headers, json={"text": "hello"})
    second = api_client.post("/api/v1/video-practice/lookup", headers={**headers, "X-Guest-Token": "b" * 40}, json={"term": "hello"})
    assert first.status_code == 200
    assert second.status_code == 429
    assert "one-time trial" in second.json()["detail"]
    assert calls == ["hello"]


def test_admin_can_use_translation_repeatedly(api_client, admin_headers, monkeypatch):
    monkeypatch.setattr("app.api.reading.translate_english_to_vietnamese", lambda text: "xin chào")
    for _ in range(3):
        assert api_client.post("/api/v1/reading/lookup", headers=admin_headers, json={"text": "hello"}).status_code == 200


def test_browser_trial_is_shared_after_logout(api_client, db_session, monkeypatch):
    calls = []
    monkeypatch.setattr("app.api.reading.translate_english_to_vietnamese", lambda text: calls.append(text) or "xin chào")
    token = "z" * 40
    headers = {**member_headers(db_session), "X-Guest-Token": token}
    assert api_client.post("/api/v1/reading/lookup", headers=headers, json={"text": "hello"}).status_code == 200
    assert api_client.post("/api/v1/reading/lookup", headers={"X-Guest-Token": token}, json={"text": "hello"}).status_code == 429
    assert calls == ["hello"]


def test_guest_cannot_reset_transcript_trial_by_changing_browser_token(api_client, monkeypatch):
    calls = []
    monkeypatch.setattr("app.api.video_practice.fetch_transcript", lambda *_: calls.append(True) or transcript())
    payload = {"video_url": "https://youtu.be/abcdefghijk", "language": "en"}
    assert api_client.post("/api/v1/video-practice/transcript", headers={"X-Guest-Token": "a" * 40}, json=payload).status_code == 200
    assert api_client.post("/api/v1/video-practice/transcript", headers={"X-Guest-Token": "b" * 40}, json=payload).status_code == 429
    assert calls == [True]


def test_flashcard_generation_and_mining_share_one_trial(api_client, monkeypatch):
    calls = []
    monkeypatch.setattr("app.api.ai.generate_ai_cards", lambda **_: calls.append("generate") or {"sheet_name": "Preview", "cards": [], "total_generated": 0})
    monkeypatch.setattr("app.api.ai.extract_chunks_from_text", lambda **_: calls.append("mine") or ("Preview", []))
    headers = {"X-Guest-Token": "a" * 40}
    assert api_client.post("/api/v1/ai/generate", headers=headers, json={"count": 5}).status_code == 200
    assert api_client.post("/api/v1/ai/mine", headers=headers, json={"text": "A short text for mining."}).status_code == 429
    assert calls == ["generate"]


def test_news_list_and_article_each_have_one_trial(api_client, db_session, monkeypatch):
    calls = []
    article = ReadingArticle(id="vnexpress:1", source_id="vnexpress", source_name="VnExpress", category="News", title="News", summary="Summary", url="https://e.vnexpress.net/news/example.html")
    monkeypatch.setattr("app.api.reading.fetch_news_articles", lambda *_: calls.append("list") or ReadingArticleList(articles=[article]))
    monkeypatch.setattr("app.api.reading.fetch_news_article", lambda _source, item: calls.append("article") or ReadingArticleContent(article=item, paragraphs=["News content"], available=True))
    headers = member_headers(db_session)
    assert api_client.get("/api/v1/reading/articles", headers=headers).status_code == 200
    assert api_client.get("/api/v1/reading/articles", headers=headers).status_code == 429
    params = {"source": "vnexpress", "url": article.url, "title": article.title}
    assert api_client.get("/api/v1/reading/articles/content", headers=headers, params=params).status_code == 200
    assert api_client.get("/api/v1/reading/articles/content", headers=headers, params=params).status_code == 429
    assert calls == ["list", "article"]


def test_provider_failure_refunds_trial(api_client, monkeypatch):
    calls = []
    def translate(text):
        calls.append(text)
        if len(calls) == 1:
            raise TranslationProviderError("Provider rate limited", status_code=429)
        return "xin chào"
    monkeypatch.setattr("app.api.reading.translate_english_to_vietnamese", translate)
    headers = {"X-Guest-Token": "a" * 40}
    assert api_client.post("/api/v1/reading/lookup", headers=headers, json={"text": "hello"}).status_code == 429
    assert api_client.post("/api/v1/reading/lookup", headers=headers, json={"text": "hello"}).status_code == 200
    assert api_client.post("/api/v1/reading/lookup", headers=headers, json={"text": "hello"}).status_code == 429
    assert len(calls) == 2


def test_concurrent_claims_are_atomic(migrated_engine):
    barrier = Barrier(2)
    def claim():
        with Session(migrated_engine) as db:
            barrier.wait()
            return GuestAIUsageRepository(db).claim_many_once(["a" * 64, "b" * 64], "translation_lookup")
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(lambda _: claim(), range(2)))
    assert sorted(outcomes) == [False, True]


def test_authenticated_member_cannot_repeat_feedback_via_guest_and_saved_routes(api_client, db_session, monkeypatch):
    seed_writing_prompts(db_session)
    headers = member_headers(db_session)
    calls = []
    monkeypatch.setattr("app.api.guest_ai.grade_writing", lambda *_: (calls.append(True) or valid_feedback(), "model"))
    first = api_client.post("/api/v1/guest/ai/writing/grade", headers=headers, json={"prompt_id": 1, "draft_text": "I lives in a small home."})
    assert first.status_code == 200, first.text
    assert api_client.get("/api/v1/writing/usage?feature=writing_feedback", headers=headers).json()["remaining"] == 0
    created = api_client.post("/api/v1/writing/attempts", headers=headers, json={"prompt_id": 1}).json()
    saved = api_client.patch(f"/api/v1/writing/attempts/{created['id']}", headers=headers, json={"version": created["version"], "draft_text": "I lives in a small home."}).json()
    blocked = api_client.post(f"/api/v1/writing/attempts/{created['id']}/grade", headers=headers, json={"version": saved["version"]})
    assert blocked.status_code == 429
    assert calls == [True]


def test_admin_speaking_has_no_internal_daily_limit(api_client, admin_headers, monkeypatch):
    monkeypatch.setattr(settings, "speaking_daily_ai_quota", 1)
    monkeypatch.setattr("app.services.speaking.transcribe_audio", lambda *_: "Hello there.")
    for _ in range(2):
        created = api_client.post("/api/v1/speaking/attempts", headers=admin_headers, json={"prompt_id": 1})
        assert created.status_code == 201, created.text
        result = api_client.post(f"/api/v1/speaking/attempts/{created.json()['id']}/transcribe", headers=admin_headers, files={"audio": ("answer.webm", b"audio", "audio/webm")})
        assert result.status_code == 200, result.text
    usage = api_client.get("/api/v1/speaking/usage", headers=admin_headers).json()
    assert usage["daily_limit"] is None and usage["remaining"] is None


def test_invalid_feedback_does_not_allow_unlimited_provider_retries(api_client, db_session, monkeypatch):
    seed_writing_prompts(db_session)
    headers = member_headers(db_session)
    calls = []
    def invalid_feedback(*_):
        calls.append(True)
        raise HTTPException(status_code=502, detail="Invalid AI response")
    monkeypatch.setattr("app.api.guest_ai.grade_writing", invalid_feedback)
    first = api_client.post("/api/v1/guest/ai/writing/grade", headers=headers, json={"prompt_id": 1, "draft_text": "A short draft."})
    second = api_client.post("/api/v1/guest/ai/writing/grade", headers=headers, json={"prompt_id": 1, "draft_text": "A short draft."})
    assert first.status_code == 502
    assert second.status_code == 429
    assert calls == [True]


def test_ai_provider_429_remains_distinct_from_app_trial_limit(monkeypatch):
    from app.services.ai_client import call_9router_chat

    class FakeClient:
        def __init__(self, **_kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *_args):
            return False
        def post(self, url, **_kwargs):
            return httpx.Response(429, request=httpx.Request("POST", url))

    monkeypatch.setattr("app.services.ai_client.httpx.Client", FakeClient)
    with pytest.raises(HTTPException) as exc:
        call_9router_chat(messages=[{"role": "user", "content": "test"}])
    assert exc.value.status_code == 429
    assert "AI provider" in exc.value.detail
