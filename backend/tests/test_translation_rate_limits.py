from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services import translation_provider, video_practice


TRANSLATION_URL = "https://translation.example/get"
DICTIONARY_URL = "https://dictionary.example/en"


@pytest.fixture(autouse=True)
def isolated_provider_state(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(translation_provider, "_translation_cache", {})
    monkeypatch.setattr(translation_provider, "_provider_retry_at", 0.0, raising=False)
    monkeypatch.setattr(translation_provider, "monotonic", lambda: clock[0])
    monkeypatch.setattr(video_practice, "_request_times", defaultdict(deque))
    monkeypatch.setattr(settings, "video_translation_api_url", TRANSLATION_URL)
    monkeypatch.setattr(settings, "video_dictionary_api_url", DICTIONARY_URL)
    monkeypatch.setattr(settings, "mymemory_email", "")
    return clock


@pytest.fixture()
def lookup_client():
    # Các endpoint tra nghĩa không phụ thuộc DB; dùng app thật mà không tạo dữ liệu hoặc migration.
    with TestClient(app) as client:
        yield client


def provider_response(status=200, payload=None, headers=None, url=TRANSLATION_URL):
    return httpx.Response(status, json=payload or {}, headers=headers, request=httpx.Request("GET", url))


@pytest.mark.parametrize(
    ("path", "body"),
    [
        ("/api/v1/reading/lookup", {"text": "Good morning."}),
        ("/api/v1/video-practice/lookup", {"term": "Good morning."}),
        ("/api/v1/video-practice/lookup", {"term": "hello"}),
    ],
)
def test_http_429_is_preserved_by_both_lookup_apis(lookup_client, monkeypatch, caplog, path, body):
    translation_calls = []

    def fake_get(url, **kwargs):
        if url.startswith(DICTIONARY_URL):
            return provider_response(404, url=url)
        assert url == TRANSLATION_URL
        translation_calls.append(kwargs)
        return httpx.Response(
            429,
            text="<html>private provider response</html>",
            headers={"Retry-After": "120"},
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr(httpx, "get", fake_get)
    response = lookup_client.post(path, json=body)

    assert response.status_code == 429
    assert response.headers["retry-after"] == "120"
    assert "translation service" in response.json()["detail"].lower()
    assert "120" in response.json()["detail"]
    assert len(translation_calls) == 1
    assert "private provider response" not in caplog.text


def test_mymemory_contact_email_is_sent_only_when_configured(monkeypatch):
    captured = []

    def fake_get(url, **kwargs):
        captured.append(kwargs["params"])
        return provider_response(payload={"responseStatus": 200, "responseData": {"translatedText": "Xin chào"}})

    monkeypatch.setattr(httpx, "get", fake_get)
    translation_provider.translate_english_to_vietnamese("Good morning.")
    assert "de" not in captured[-1]

    translation_provider._translation_cache.clear()
    monkeypatch.setattr(settings, "mymemory_email", "  learner@example.com  ")
    translation_provider.translate_english_to_vietnamese("Good evening.")

    assert captured[-1]["de"] == "learner@example.com"


@pytest.mark.parametrize("source", ["reading", "video-practice"])
@pytest.mark.parametrize(
    "payload",
    [
        {"responseStatus": 429},
        {"responseStatus": "429"},
        {"responseStatus": 200, "quotaFinished": True, "responseData": {"translatedText": "quota exhausted"}},
    ],
)
def test_provider_json_quota_error_is_not_a_successful_translation(lookup_client, monkeypatch, source, payload):
    monkeypatch.setattr(httpx, "get", lambda *args, **kwargs: provider_response(payload=payload))
    body = {"text": "Good morning."} if source == "reading" else {"term": "Good morning."}

    response = lookup_client.post(f"/api/v1/{source}/lookup", json=body)

    assert response.status_code == 429
    assert response.headers["retry-after"] == "60"
    assert "quota exhausted" not in response.text


def test_cooldown_is_shared_cache_still_works_and_provider_recovers(lookup_client, monkeypatch, isolated_provider_state):
    requested_terms = []

    def fake_get(url, **kwargs):
        assert url == TRANSLATION_URL
        term = kwargs["params"]["q"]
        requested_terms.append(term)
        if term == "Limited sentence.":
            return provider_response(429, headers={"Retry-After": "90"})
        return provider_response(payload={"responseStatus": 200, "responseData": {"translatedText": "Bản dịch mẫu"}})

    monkeypatch.setattr(httpx, "get", fake_get)
    warm = lookup_client.post("/api/v1/reading/lookup", json={"text": "Good morning."})
    limited = lookup_client.post("/api/v1/reading/lookup", json={"text": "Limited sentence."})
    cached = lookup_client.post("/api/v1/video-practice/lookup", json={"term": "Good morning."})
    blocked = lookup_client.post("/api/v1/video-practice/lookup", json={"term": "Another sentence."})

    assert warm.status_code == cached.status_code == 200
    assert cached.json()["translation_vi"] == warm.json()["translation_vi"]
    assert limited.status_code == blocked.status_code == 429
    assert blocked.headers["retry-after"] == "90"
    assert requested_terms == ["Good morning.", "Limited sentence."]

    isolated_provider_state[0] += 30
    waiting = lookup_client.post("/api/v1/reading/lookup", json={"text": "Another sentence."})
    assert waiting.status_code == 429
    assert waiting.headers["retry-after"] == "60"

    isolated_provider_state[0] += 61
    recovered = lookup_client.post("/api/v1/video-practice/lookup", json={"term": "Another sentence."})
    assert recovered.status_code == 200
    assert requested_terms == ["Good morning.", "Limited sentence.", "Another sentence."]


def test_word_lookup_keeps_definitions_and_reports_missing_translation(lookup_client, monkeypatch):
    def fake_get(url, **kwargs):
        if url.startswith(DICTIONARY_URL):
            return provider_response(payload=[{
                "phonetic": "/həˈləʊ/",
                "phonetics": [{"audio": "https://api.dictionaryapi.dev/media/hello.mp3"}],
                "meanings": [{"definitions": [{"definition": "A greeting."}]}],
            }], url=url)
        return provider_response(429, headers={"Retry-After": "75"})

    monkeypatch.setattr(httpx, "get", fake_get)
    response = lookup_client.post("/api/v1/video-practice/lookup", json={"term": "hello"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["translation_vi"] is None
    assert payload["definitions"][0]["definition"] == "A greeting."
    assert payload["audio_url"].endswith("hello.mp3")
    assert "rate limit" in payload["translation_error"].lower()
    assert payload["translation_retry_after"] == 75


def test_provider_still_limited_after_cooldown_restarts_wait_without_retry_loop(lookup_client, monkeypatch, isolated_provider_state):
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        return provider_response(429)

    monkeypatch.setattr(httpx, "get", fake_get)
    first = lookup_client.post("/api/v1/reading/lookup", json={"text": "Good morning."})
    isolated_provider_state[0] += 61
    second = lookup_client.post("/api/v1/video-practice/lookup", json={"term": "Good morning."})
    waiting = lookup_client.post("/api/v1/reading/lookup", json={"text": "Good morning."})

    assert first.status_code == second.status_code == waiting.status_code == 429
    assert second.headers["retry-after"] == waiting.headers["retry-after"] == "60"
    assert len(calls) == 2


@pytest.mark.parametrize(("header", "expected"), [(None, 60), ("invalid", 60), ("-5", 60), ("0", 1), ("45", 45)])
def test_retry_after_seconds_are_validated(lookup_client, monkeypatch, header, expected):
    headers = {"Retry-After": header} if header is not None else {}
    monkeypatch.setattr(httpx, "get", lambda *args, **kwargs: provider_response(429, headers=headers))

    response = lookup_client.post("/api/v1/reading/lookup", json={"text": "Good morning."})

    assert response.status_code == 429
    assert response.headers["retry-after"] == str(expected)


def test_retry_after_http_date_is_supported(lookup_client, monkeypatch):
    fixed_now = datetime(2026, 10, 27, tzinfo=timezone.utc)

    class FixedDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed_now

    monkeypatch.setattr(translation_provider, "datetime", FixedDatetime, raising=False)
    header = format_datetime(fixed_now + timedelta(seconds=120), usegmt=True)
    monkeypatch.setattr(httpx, "get", lambda *args, **kwargs: provider_response(429, headers={"Retry-After": header}))

    response = lookup_client.post("/api/v1/reading/lookup", json={"text": "Good morning."})

    assert response.status_code == 429
    assert response.headers["retry-after"] == "120"


def test_other_provider_failures_remain_502_without_starting_cooldown(lookup_client, monkeypatch):
    responses = iter([
        provider_response(503),
        provider_response(payload={"responseStatus": 200, "responseData": {"translatedText": "Xin chào"}}),
    ])
    monkeypatch.setattr(httpx, "get", lambda *args, **kwargs: next(responses))

    failed = lookup_client.post("/api/v1/reading/lookup", json={"text": "Hello."})
    recovered = lookup_client.post("/api/v1/reading/lookup", json={"text": "Hello."})

    assert failed.status_code == 502
    assert "retry-after" not in failed.headers
    assert recovered.status_code == 200


def test_dictionary_429_does_not_discard_successful_translation(lookup_client, monkeypatch):
    def fake_get(url, **kwargs):
        if url.startswith(DICTIONARY_URL):
            return provider_response(429, url=url)
        return provider_response(payload={"responseStatus": 200, "responseData": {"translatedText": "Xin chào"}})

    monkeypatch.setattr(httpx, "get", fake_get)
    response = lookup_client.post("/api/v1/video-practice/lookup", json={"term": "hello"})

    assert response.status_code == 200
    assert response.json()["translation_vi"] == "Xin chào"
    assert response.json()["definitions"] == []
    assert response.json().get("translation_error") is None
