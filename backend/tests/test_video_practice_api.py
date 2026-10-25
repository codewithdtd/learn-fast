from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.schemas.video_practice import TranscriptResponse
from app.services.dictionary_provider import lookup_word
from app.services.video_practice import _request_times, enforce_request_limit
from app.services.transcript_provider import VideoPracticeProviderError, extract_youtube_video_id, fetch_transcript


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://youtu.be/abcdefghijk", "abcdefghijk"),
        ("https://www.youtube.com/watch?v=abcdefghijk&t=20", "abcdefghijk"),
        ("https://m.youtube.com/shorts/abcdefghijk", "abcdefghijk"),
    ],
)
def test_extracts_supported_youtube_video_links(url: str, expected: str) -> None:
    assert extract_youtube_video_id(url) == expected


def test_rejects_non_youtube_or_malformed_urls() -> None:
    for url in ("https://example.com/abcdefghijk", "https://youtube.com/watch?v=bad", "javascript:alert(1)"):
        with pytest.raises(VideoPracticeProviderError) as error:
            extract_youtube_video_id(url)
        assert error.value.status_code == 422


def test_transcript_provider_returns_timestamped_lines_without_database_access(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ytranscript_api_key", "provider-test-key")
    monkeypatch.setattr(settings, "ytranscript_api_url", "https://provider.example/transcript")
    request: dict[str, object] = {}

    def fake_get(url: str, **kwargs):
        request.update(url=url, **kwargs)
        return SimpleNamespace(
            status_code=200,
            json=lambda: {
                "lang": "en",
                "whisper": False,
                "segments": [
                    {"offset": 0, "duration": 2500, "text": "Good morning."},
                    {"offset": 2500, "duration": 1400, "text": "Welcome back."},
                ],
            },
            raise_for_status=lambda: None,
        )

    monkeypatch.setattr("app.services.transcript_provider.httpx.get", fake_get)

    result = fetch_transcript("https://youtu.be/abcdefghijk", "en")

    assert isinstance(result, TranscriptResponse)
    assert result.video_id == "abcdefghijk"
    assert result.language_code == "en"
    assert result.caption_type == "native"
    assert result.segments[1].start == 2.5
    assert result.segments[1].duration == 1.4
    assert result.segments[1].text == "Welcome back."
    assert request["url"] == "https://provider.example/transcript"
    assert request["params"] == {"videoId": "abcdefghijk", "lang": "en"}
    assert request["headers"] == {"Authorization": "Bearer provider-test-key"}


def test_transcript_endpoint_reports_missing_provider_configuration(api_client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "ytranscript_api_key", "")
    response = api_client.post(
        "/api/v1/video-practice/transcript",
        json={"video_url": "https://youtu.be/abcdefghijk", "language": "en"},
    )
    assert response.status_code == 503
    assert response.json()["detail"].startswith("Video transcript lookup is not configured.")


def test_transcript_request_rejects_untrusted_hosts(api_client) -> None:
    response = api_client.post(
        "/api/v1/video-practice/transcript",
        json={"video_url": "https://example.com/watch?v=abcdefghijk", "language": "en"},
    )
    assert response.status_code == 422


def test_transcript_request_rejects_unknown_fields_and_bad_language(api_client) -> None:
    unknown_field = api_client.post(
        "/api/v1/video-practice/transcript",
        json={"video_url": "https://youtu.be/abcdefghijk", "language": "en", "unknown": True},
    )
    bad_language = api_client.post(
        "/api/v1/video-practice/transcript",
        json={"video_url": "https://youtu.be/abcdefghijk", "language": "en--bad"},
    )
    assert unknown_field.status_code == 422
    assert bad_language.status_code == 422


def test_word_lookup_combines_free_definition_translation_and_safe_audio(monkeypatch) -> None:
    monkeypatch.setattr(settings, "video_dictionary_api_url", "https://dictionary.example/en")
    monkeypatch.setattr(settings, "video_translation_api_url", "https://translation.example/get")
    request_urls: list[str] = []

    def fake_get(url: str, **kwargs):
        request_urls.append(url)
        if "dictionary.example" in url:
            return SimpleNamespace(
                status_code=200,
                json=lambda: [{
                    "phonetic": "/ˈdɪli/",
                    "phonetics": [{"audio": "https://api.dictionaryapi.dev/media/daily.mp3"}],
                    "meanings": [{"partOfSpeech": "adverb", "definitions": [{"definition": "Every day.", "example": "I walk daily."}]}],
                }],
                raise_for_status=lambda: None,
            )
        return SimpleNamespace(
            status_code=200,
            json=lambda: {"responseStatus": 200, "responseData": {"translatedText": "hằng ngày"}},
            raise_for_status=lambda: None,
        )

    monkeypatch.setattr("app.services.dictionary_provider.httpx.get", fake_get)
    result = lookup_word("daily", "I walk daily.")

    assert result.translation_vi == "hằng ngày"
    assert result.phonetic == "/ˈdɪli/"
    assert result.audio_url == "https://api.dictionaryapi.dev/media/daily.mp3"
    assert result.definitions[0].example == "I walk daily."
    assert "I walk daily." not in " ".join(request_urls)


def test_phrase_lookup_skips_single_word_dictionary_and_returns_translation(monkeypatch) -> None:
    requested_urls: list[str] = []

    def fake_get(url: str, **kwargs):
        requested_urls.append(url)
        return SimpleNamespace(
            status_code=200,
            json=lambda: {"responseStatus": 200, "responseData": {"translatedText": "Tôi đi bộ mỗi ngày."}},
            raise_for_status=lambda: None,
        )

    monkeypatch.setattr("app.services.dictionary_provider.httpx.get", fake_get)
    result = lookup_word("I walk every day.", "I walk every day.")

    assert result.translation_vi == "Tôi đi bộ mỗi ngày."
    assert result.definitions == []
    assert len(requested_urls) == 1
    assert requested_urls[0] == settings.video_translation_api_url


def test_word_lookup_request_accepts_sentence_length_terms() -> None:
    from app.schemas.video_practice import WordLookupRequest

    sentence = "Describe your usual morning routine and explain what helps you feel ready for the day."
    request = WordLookupRequest(term=sentence, context=None)

    assert request.term == sentence


def test_video_practice_limits_provider_requests_per_client(monkeypatch) -> None:
    key = "video-practice-rate-test"
    monkeypatch.setattr(settings, "video_practice_requests_per_minute", 1)
    _request_times.pop(key, None)
    try:
        enforce_request_limit(key)
        with pytest.raises(HTTPException) as error:
            enforce_request_limit(key)
        assert error.value.status_code == 429
    finally:
        _request_times.pop(key, None)
