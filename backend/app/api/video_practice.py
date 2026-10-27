from fastapi import APIRouter, HTTPException, Request

from app.core.config import settings
from app.schemas.video_practice import (
    TranscriptRequest,
    TranscriptResponse,
    WordLookupRequest,
    WordLookupResponse,
)
from app.services.dictionary_provider import lookup_word
from app.services.transcript_provider import VideoPracticeProviderError, fetch_transcript
from app.services.translation_provider import TranslationProviderError
from app.services.video_practice import enforce_request_limit


router = APIRouter(prefix="/video-practice", tags=["video-practice"])


@router.post("/transcript", response_model=TranscriptResponse)
def get_transcript(payload: TranscriptRequest, request: Request) -> TranscriptResponse:
    enforce_request_limit(request.client.host if request.client else "unknown")
    try:
        return fetch_transcript(payload.video_url, payload.language)
    except VideoPracticeProviderError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error


@router.post("/lookup", response_model=WordLookupResponse)
def get_word_lookup(payload: WordLookupRequest, request: Request) -> WordLookupResponse:
    enforce_request_limit(request.client.host if request.client else "unknown")
    try:
        return lookup_word(payload.term, payload.context)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except TranslationProviderError as error:
        headers = {"Retry-After": str(error.retry_after)} if error.retry_after is not None else None
        raise HTTPException(status_code=error.status_code, detail=str(error), headers=headers) from error
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@router.get("/status")
def get_video_practice_status() -> dict[str, bool]:
    return {"transcript_configured": bool(settings.ytranscript_api_key.strip())}
