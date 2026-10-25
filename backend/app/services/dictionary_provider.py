import html
import logging
import re
from urllib.parse import quote, urlparse

import httpx

from app.core.config import settings
from app.schemas.video_practice import DictionaryDefinition, WordLookupResponse


logger = logging.getLogger(__name__)


def lookup_word(term: str, context: str | None) -> WordLookupResponse:
    # Từ điển miễn phí chỉ xử lý ổn định từ đơn; cụm/câu cần đi thẳng qua dịch máy để tránh truy vấn sai endpoint từ điển.
    # Transcript thường thêm dấu chấm/phẩy vào một từ; bỏ dấu ở rìa khi phân loại để không vô tình bỏ qua từ điển.
    dictionary_term = term.strip().strip(".,!?;:()[]{}\"“”‘’")
    is_single_word = re.fullmatch(r"[A-Za-z]+(?:['’-][A-Za-z]+)*", dictionary_term) is not None
    definition_data = _get_english_definition(dictionary_term) if is_single_word else None
    translation = _get_vietnamese_translation(term)

    phonetic: str | None = None
    audio_url: str | None = None
    definitions: list[DictionaryDefinition] = []
    if isinstance(definition_data, list):
        for entry in definition_data:
            if not isinstance(entry, dict):
                continue
            if phonetic is None and isinstance(entry.get("phonetic"), str):
                phonetic = entry["phonetic"][:100]
            phonetics = entry.get("phonetics")
            if isinstance(phonetics, list):
                for sound in phonetics:
                    if not isinstance(sound, dict):
                        continue
                    if phonetic is None and isinstance(sound.get("text"), str):
                        phonetic = sound["text"][:100]
                    if audio_url is None and isinstance(sound.get("audio"), str):
                        candidate = sound["audio"]
                        audio_host = (urlparse(candidate).hostname or "").lower()
                        if candidate.startswith("https://") and (
                            audio_host == "dictionaryapi.dev" or audio_host.endswith(".dictionaryapi.dev")
                        ):
                            audio_url = candidate[:1000]
            meanings = entry.get("meanings")
            if isinstance(meanings, list):
                for meaning in meanings:
                    if not isinstance(meaning, dict):
                        continue
                    part_of_speech = meaning.get("partOfSpeech")
                    word_definitions = meaning.get("definitions")
                    if not isinstance(word_definitions, list):
                        continue
                    for definition in word_definitions:
                        if not isinstance(definition, dict) or not isinstance(definition.get("definition"), str):
                            continue
                        definitions.append(
                            DictionaryDefinition(
                                part_of_speech=part_of_speech[:60] if isinstance(part_of_speech, str) else None,
                                definition=definition["definition"][:600],
                                example=definition.get("example", "")[:400] or None
                                if isinstance(definition.get("example", ""), str)
                                else None,
                            )
                        )
                        if len(definitions) >= 5:
                            break
                    if len(definitions) >= 5:
                        break
            if len(definitions) >= 5:
                break

    if not definitions and translation is None:
        raise RuntimeError("No dictionary result is available for this text.")
    # The context is intentionally not sent to third-party lookup providers; it stays in the browser session.
    del context
    return WordLookupResponse(
        term=term,
        translation_vi=translation,
        phonetic=phonetic,
        audio_url=audio_url,
        definitions=definitions,
    )


def _get_english_definition(term: str) -> list[object] | None:
    try:
        response = httpx.get(
            f"{settings.video_dictionary_api_url.rstrip('/')}/{quote(term, safe='')}",
            timeout=settings.video_practice_provider_timeout,
        )
        if response.status_code == 404:
            return None
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPStatusError as error:
        logger.warning("Free Dictionary request failed with HTTP %s", error.response.status_code)
        return None
    except httpx.RequestError as error:
        logger.warning("Free Dictionary request failed (%s)", type(error).__name__)
        return None
    except ValueError as error:
        logger.warning("Free Dictionary returned invalid JSON (%s)", type(error).__name__)
        return None
    return payload if isinstance(payload, list) else None


def _get_vietnamese_translation(term: str) -> str | None:
    try:
        response = httpx.get(
            settings.video_translation_api_url,
            params={"q": term, "langpair": "en|vi"},
            timeout=settings.video_practice_provider_timeout,
        )
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPStatusError as error:
        # Không ghi term/context vào log để tránh lưu nội dung transcript; status upstream đủ để phân biệt quota và lỗi HTTP.
        logger.warning("MyMemory translation request failed with HTTP %s", error.response.status_code)
        return None
    except httpx.RequestError as error:
        logger.warning("MyMemory translation request failed (%s)", type(error).__name__)
        return None
    except ValueError as error:
        logger.warning("MyMemory returned invalid JSON (%s)", type(error).__name__)
        return None
    if not isinstance(payload, dict):
        logger.warning("MyMemory returned an unexpected response shape")
        return None
    response_status = payload.get("responseStatus")
    # Một số proxy/provider wrapper serialize số trạng thái thành chuỗi; chấp nhận cả hai dạng tương đương.
    if isinstance(response_status, str) and response_status.isdigit():
        response_status = int(response_status)
    if response_status != 200:
        logger.warning("MyMemory returned application status %s", response_status)
        return None
    data = payload.get("responseData")
    value = data.get("translatedText") if isinstance(data, dict) else None
    if not isinstance(value, str):
        logger.warning("MyMemory response did not include translated text")
        return None
    cleaned = re.sub(r"<[^>]*>", "", html.unescape(value)).strip()
    return cleaned[:1000] or None
