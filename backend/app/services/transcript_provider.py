import re
from math import isfinite
from urllib.parse import parse_qs, urlparse

import httpx

from app.core.config import settings
from app.schemas.video_practice import TranscriptResponse, TranscriptSegment


class VideoPracticeProviderError(RuntimeError):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


def extract_youtube_video_id(video_url: str) -> str:
    parsed = urlparse(video_url.strip())
    host = (parsed.hostname or "").lower().removeprefix("www.")
    if host == "youtu.be":
        candidate = parsed.path.strip("/").split("/")[0]
    elif host in {"youtube.com", "m.youtube.com", "youtube-nocookie.com"}:
        path_parts = [part for part in parsed.path.split("/") if part]
        candidate = parse_qs(parsed.query).get("v", [""])[0]
        if not candidate and len(path_parts) >= 2 and path_parts[0] in {"embed", "shorts", "live"}:
            candidate = path_parts[1]
    else:
        candidate = ""
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", candidate):
        raise VideoPracticeProviderError("Enter a valid YouTube video link.", 422)
    return candidate


def fetch_transcript(video_url: str, language: str) -> TranscriptResponse:
    video_id = extract_youtube_video_id(video_url)
    api_key = settings.ytranscript_api_key.strip()
    if not api_key:
        raise VideoPracticeProviderError(
            "Video transcript lookup is not configured. Add YTRANSCRIPT_API_KEY on the backend.",
            503,
        )
    try:
        response = httpx.get(
            settings.ytranscript_api_url,
            params={"videoId": video_id, "lang": language},
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=settings.video_practice_provider_timeout,
        )
        if response.status_code == 402:
            raise VideoPracticeProviderError(
                "YTranscript monthly credits have been used. Try again after the quota resets.",
                429,
            )
        if response.status_code == 404:
            raise VideoPracticeProviderError("No transcript is available for this video and language.", 404)
        if response.status_code in {401, 403}:
            raise VideoPracticeProviderError(
                "YTranscript rejected the backend API key. Check YTRANSCRIPT_API_KEY.", 503
            )
        response.raise_for_status()
        payload = response.json()
    except httpx.TimeoutException as error:
        raise VideoPracticeProviderError("Transcript lookup timed out. Please try again.", 504) from error
    except VideoPracticeProviderError:
        raise
    except httpx.HTTPStatusError as error:
        status_code = 429 if error.response.status_code == 429 else 502
        raise VideoPracticeProviderError(
            f"YTranscript returned HTTP {error.response.status_code}. Transcript lookup is temporarily unavailable.",
            status_code,
        ) from error
    except httpx.RequestError as error:
        raise VideoPracticeProviderError("YTranscript could not be reached. Please try again.", 502) from error
    except ValueError as error:
        raise VideoPracticeProviderError("YTranscript returned an invalid transcript response.", 502) from error

    if not isinstance(payload, dict):
        raise VideoPracticeProviderError("YTranscript returned an invalid transcript response.", 502)
    segments_data = payload.get("segments")
    if not isinstance(segments_data, list):
        raise VideoPracticeProviderError("This video does not have timestamped transcript lines.", 404)

    segments: list[TranscriptSegment] = []
    for item in segments_data[:1000]:
        if not isinstance(item, dict):
            continue
        text = item.get("text")
        if not isinstance(text, str) or not text.strip():
            continue
        try:
            # API timestamps are milliseconds; the player contract uses seconds.
            start = float(item.get("offset", 0)) / 1000
            duration = float(item.get("duration", 0)) / 1000
            if not isfinite(start) or not isfinite(duration) or start < 0 or not 0 < duration <= 120:
                continue
            # Keep provider caption boundaries so the displayed text and playback interval stay paired.
            segments.append(
                TranscriptSegment(
                    start=start,
                    duration=duration,
                    text=text.strip()[:1000],
                )
            )
        except (TypeError, ValueError):
            continue
    if not segments:
        raise VideoPracticeProviderError("No usable timestamped transcript lines were found.", 404)

    return TranscriptResponse(
        video_id=video_id,
        title=None,
        author_name=None,
        language_code=_optional_text(payload, "lang") or language,
        caption_type="auto" if payload.get("whisper") is True else "native",
        segments=segments,
    )


def _optional_text(payload: dict[str, object], key: str) -> str | None:
    value = payload.get(key)
    return value[:255] if isinstance(value, str) else None
