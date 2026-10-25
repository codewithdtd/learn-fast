import re
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
    if not settings.youtube_transcript_api_key.strip():
        raise VideoPracticeProviderError(
            "Video transcript lookup is not configured. Add YOUTUBE_TRANSCRIPT_API_KEY on the backend.",
            503,
        )
    try:
        response = httpx.get(
            settings.youtube_transcript_api_url,
            params={"v": video_id, "language": language, "timestamps": "true"},
            headers={"Authorization": f"Bearer {settings.youtube_transcript_api_key}"},
            timeout=settings.video_practice_provider_timeout,
        )
        response.raise_for_status()
        payload = response.json()
    except httpx.TimeoutException as error:
        raise VideoPracticeProviderError("Transcript lookup timed out. Please try again.", 504) from error
    except httpx.HTTPStatusError as error:
        status_code = 429 if error.response.status_code == 429 else 502
        raise VideoPracticeProviderError(
            "The transcript provider is temporarily unavailable. Please try again later.", status_code
        ) from error
    except (httpx.RequestError, ValueError) as error:
        raise VideoPracticeProviderError("The transcript provider could not be reached.", 502) from error

    if not isinstance(payload, dict) or payload.get("success") is not True:
        raise VideoPracticeProviderError("No transcript is available for this video and language.", 404)
    data = payload.get("data")
    segments_data = data.get("segments") if isinstance(data, dict) else None
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
            segments.append(
                TranscriptSegment(
                    start=float(item.get("start", 0)),
                    duration=float(item.get("duration", 0)),
                    text=text.strip()[:1000],
                )
            )
        except (TypeError, ValueError):
            continue
    if not segments:
        raise VideoPracticeProviderError("No usable timestamped transcript lines were found.", 404)

    return TranscriptResponse(
        video_id=video_id,
        title=_optional_text(data, "title"),
        author_name=_optional_text(data, "author_name"),
        language_code=_optional_text(data, "language_code"),
        caption_type=_optional_text(data, "caption_type"),
        segments=segments,
    )


def _optional_text(payload: dict[str, object], key: str) -> str | None:
    value = payload.get(key)
    return value[:255] if isinstance(value, str) else None
