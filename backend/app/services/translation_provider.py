import html
import logging
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from math import ceil
from threading import Lock
from time import monotonic

import httpx

from app.core.config import settings


logger = logging.getLogger(__name__)
CACHE_SECONDS = 3600
CACHE_LIMIT = 1000
DEFAULT_RETRY_AFTER_SECONDS = 60
_cache_lock = Lock()
_translation_cache: dict[str, tuple[float, str]] = {}
_provider_retry_at = 0.0


class TranslationProviderError(RuntimeError):
    """Raised when the free translation provider has no result or is unavailable."""

    def __init__(self, message: str, *, status_code: int = 502, retry_after: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.retry_after = retry_after


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
    # Quota thuộc provider dùng chung: vẫn phục vụ cache, nhưng không gửi thêm truy vấn mới trong thời gian chờ.
    with _cache_lock:
        retry_after = ceil(_provider_retry_at - monotonic())
    if retry_after > 0:
        raise _rate_limit_error(retry_after)
    # MyMemory raises its published allowance for identified requests; keep anonymous calls unchanged when unset.
    params = {"q": selected, "langpair": "en|vi"}
    contact_email = settings.mymemory_email.strip()
    if contact_email:
        params["de"] = contact_email
    try:
        response = httpx.get(
            settings.video_translation_api_url,
            params=params,
            timeout=settings.video_practice_provider_timeout,
            headers={"User-Agent": "LearnFastReading/1.0"},
        )
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPStatusError as error:
        if error.response.status_code == 429:
            retry_after = _start_provider_cooldown(error.response.headers.get("Retry-After"))
            logger.warning("Translation provider returned HTTP 429 (retry_after=%s)", retry_after)
            raise _rate_limit_error(retry_after) from error
        logger.warning("Translation provider returned HTTP %s", error.response.status_code)
        raise TranslationProviderError("Translation is temporarily unavailable. Please try again.") from error
    except (httpx.RequestError, ValueError) as error:
        logger.warning("Translation provider failed (%s)", type(error).__name__)
        raise TranslationProviderError("Translation is temporarily unavailable. Please try again.") from error
    # MyMemory có thể trả HTTP 200 nhưng quota lỗi nằm trong JSON; không đưa chuỗi báo hết quota thành bản dịch.
    if isinstance(payload, dict) and (payload.get("responseStatus") in (429, "429") or payload.get("quotaFinished") is True):
        retry_after = _start_provider_cooldown(response.headers.get("Retry-After"))
        logger.warning("Translation provider reported quota exhaustion (retry_after=%s)", retry_after)
        raise _rate_limit_error(retry_after)
    if not isinstance(payload, dict) or payload.get("responseStatus") not in (200, "200"):
        status = payload.get("responseStatus") if isinstance(payload, dict) else "unknown"
        logger.warning("Translation provider returned status %s", status)
        raise TranslationProviderError("No translation was returned. Try a different selection.")
    response_data = payload.get("responseData")
    translated = response_data.get("translatedText") if isinstance(response_data, dict) else None
    if not isinstance(translated, str) or not translated.strip():
        raise TranslationProviderError("No translation was returned. Try a different selection.")
    result = re.sub(r"<[^>]*>", "", html.unescape(translated)).strip()[:2000]
    _set_cached(key, result)
    return result


def _rate_limit_error(retry_after: int) -> TranslationProviderError:
    return TranslationProviderError(
        f"The translation service is currently rate limited. Please wait {retry_after} seconds before trying again.",
        status_code=429,
        retry_after=retry_after,
    )


def _start_provider_cooldown(header: str | None) -> int:
    global _provider_retry_at
    retry_after = DEFAULT_RETRY_AFTER_SECONDS
    if header:
        try:
            if header.strip().isdigit():
                retry_after = max(1, int(header.strip()))
            else:
                deadline = parsedate_to_datetime(header)
                if deadline.tzinfo is None:
                    deadline = deadline.replace(tzinfo=timezone.utc)
                retry_after = max(1, ceil((deadline - datetime.now(timezone.utc)).total_seconds()))
        except (ValueError, TypeError, OverflowError):
            retry_after = DEFAULT_RETRY_AFTER_SECONDS
    with _cache_lock:
        # Không để một phản hồi đồng thời có thời gian ngắn hơn rút ngắn cửa sổ provider đã yêu cầu chờ.
        now = monotonic()
        _provider_retry_at = max(_provider_retry_at, now + retry_after)
        return max(1, ceil(_provider_retry_at - now))


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
