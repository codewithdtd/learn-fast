import html
import logging
import re
from threading import Lock
from time import monotonic

import httpx

from app.core.config import settings


logger = logging.getLogger(__name__)
CACHE_SECONDS = 3600
CACHE_LIMIT = 1000
_cache_lock = Lock()
_translation_cache: dict[str, tuple[float, str]] = {}


class TranslationProviderError(RuntimeError):
    """Raised when the free translation provider has no result or is unavailable."""


def translate_english_to_vietnamese(text: str) -> str:
    selected = text.strip()
    if not selected:
        raise ValueError("Select text to translate.")
    # MyMemory giới hạn truy vấn theo byte UTF-8; kiểm tra trước để selection dài không bị provider từ chối hoặc tính quota vô ích.
    if len(selected.encode("utf-8")) > 500:
        raise ValueError("The selected text is too long. Please translate a shorter selection.")
    key = selected.casefold()
    cached = _get_cached(key)
    if cached:
        return cached
    try:
        response = httpx.get(
            settings.video_translation_api_url,
            params={"q": selected, "langpair": "en|vi"},
            timeout=settings.video_practice_provider_timeout,
            headers={"User-Agent": "LearnFastReading/1.0"},
        )
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPStatusError as error:
        logger.warning("Reading translation provider returned HTTP %s", error.response.status_code)
        raise TranslationProviderError("Translation is temporarily unavailable. Please try again.") from error
    except (httpx.RequestError, ValueError) as error:
        logger.warning("Reading translation provider failed (%s)", type(error).__name__)
        raise TranslationProviderError("Translation is temporarily unavailable. Please try again.") from error
    if not isinstance(payload, dict) or payload.get("responseStatus") not in (200, "200"):
        status = payload.get("responseStatus") if isinstance(payload, dict) else "unknown"
        logger.warning("Reading translation provider returned status %s", status)
        raise TranslationProviderError("No translation was returned. Try a different selection.")
    response_data = payload.get("responseData")
    translated = response_data.get("translatedText") if isinstance(response_data, dict) else None
    if not isinstance(translated, str) or not translated.strip():
        raise TranslationProviderError("No translation was returned. Try a different selection.")
    result = re.sub(r"<[^>]*>", "", html.unescape(translated)).strip()[:2000]
    _set_cached(key, result)
    return result


def _get_cached(key: str) -> str | None:
    with _cache_lock:
        cached = _translation_cache.get(key)
        if cached and cached[0] > monotonic():
            return cached[1]
        _translation_cache.pop(key, None)
        return None


def _set_cached(key: str, value: str) -> None:
    with _cache_lock:
        if len(_translation_cache) >= CACHE_LIMIT:
            oldest_key = min(_translation_cache, key=lambda item: _translation_cache[item][0])
            _translation_cache.pop(oldest_key, None)
        _translation_cache[key] = (monotonic() + CACHE_SECONDS, value)
