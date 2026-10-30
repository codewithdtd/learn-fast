from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
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
from app.services.guest_ai_quota import provider_trial
from app.services.ielts_transcript_ticket import issue_transcript_ticket, transcript_owner_key


router = APIRouter(prefix="/video-practice", tags=["video-practice"])


@router.post("/transcript", response_model=TranscriptResponse)
def get_transcript(payload: TranscriptRequest, request: Request, db: Session = Depends(get_db), current_user: User | None = Depends(get_current_user_optional)) -> TranscriptResponse:
    if current_user is None or not current_user.is_superuser:
        enforce_request_limit(request.client.host if request.client else "unknown")
    try:
        with provider_trial(db, request, "video_transcript", current_user):
            transcript = fetch_transcript(payload.video_url, payload.language)
            ticket = issue_transcript_ticket(transcript, transcript_owner_key(request, current_user))
            return transcript.model_copy(update={"ielts_source_ticket": ticket})
    except VideoPracticeProviderError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error


@router.post("/lookup", response_model=WordLookupResponse)
def get_word_lookup(payload: WordLookupRequest, request: Request, db: Session = Depends(get_db), current_user: User | None = Depends(get_current_user_optional)) -> WordLookupResponse:
    if current_user is None or not current_user.is_superuser:
        enforce_request_limit(request.client.host if request.client else "unknown")
    try:
        with provider_trial(db, request, "translation_lookup", current_user):
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
