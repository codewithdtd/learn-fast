import html
import re
from urllib.parse import quote, urlparse

import httpx

from app.core.config import settings
from app.schemas.video_practice import DictionaryDefinition, WordLookupResponse


def lookup_word(term: str, context: str | None) -> WordLookupResponse:
    # Từ điển miễn phí chỉ xử lý ổn định từ đơn; cụm/câu cần đi thẳng qua dịch máy để tránh truy vấn sai endpoint từ điển.
    is_single_word = re.fullmatch(r"[A-Za-z]+(?:['’-][A-Za-z]+)*", term) is not None
    definition_data = _get_english_definition(term) if is_single_word else None
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
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError):
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
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError):
        return None
    if not isinstance(payload, dict) or payload.get("responseStatus") != 200:
        return None
    data = payload.get("responseData")
    value = data.get("translatedText") if isinstance(data, dict) else None
    if not isinstance(value, str):
        return None
    cleaned = re.sub(r"<[^>]*>", "", html.unescape(value)).strip()
    return cleaned[:1000] or None
