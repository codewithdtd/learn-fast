from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.speaking import (
    SpeakingAttemptCreate,
    SpeakingAttemptList,
    SpeakingAttemptRead,
    SpeakingGradeRequest,
    SpeakingPromptList,
    SpeakingTranscriptSave,
    SpeakingUsageRead,
)
from app.services import speaking as speaking_service

router = APIRouter(prefix="/speaking", tags=["speaking"])


@router.get("/prompts", response_model=SpeakingPromptList)
def prompts(db: Session = Depends(get_db)) -> SpeakingPromptList:
    return speaking_service.list_prompts(db)


@router.post("/attempts", response_model=SpeakingAttemptRead, status_code=status.HTTP_201_CREATED)
def create_attempt(
    payload: SpeakingAttemptCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SpeakingAttemptRead:
    return speaking_service.create_attempt(db, current_user.id, payload.prompt_id)


@router.post("/attempts/random", response_model=SpeakingAttemptRead, status_code=status.HTTP_201_CREATED)
def generate_random_attempt(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SpeakingAttemptRead:
    return speaking_service.generate_random_attempt(db, current_user.id)


@router.post("/attempts/{attempt_id}/transcribe", response_model=SpeakingAttemptRead)
def transcribe_attempt(
    attempt_id: int,
    audio: Annotated[UploadFile, File(...)],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SpeakingAttemptRead:
    mime_type = (audio.content_type or "").split(";", 1)[0].strip().lower()
    allowed = {"audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/aac", "audio/m4a", "audio/opus"}
    if mime_type not in allowed:
        raise HTTPException(status_code=415, detail="This recording format is not supported.")
    # Endpoint đồng bộ chạy trong worker pool để chờ Gemini không chặn event loop.
    audio_bytes = audio.file.read(settings.speaking_max_audio_bytes + 1)
    audio.file.close()
    return speaking_service.transcribe(db, current_user.id, attempt_id, audio_bytes, mime_type)


@router.patch("/attempts/{attempt_id}", response_model=SpeakingAttemptRead)
def save_transcript(
    attempt_id: int,
    payload: SpeakingTranscriptSave,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SpeakingAttemptRead:
    return speaking_service.save_transcript(db, current_user.id, attempt_id, payload.version, payload.transcript)


@router.post("/attempts/{attempt_id}/grade", response_model=SpeakingAttemptRead)
def grade_attempt(
    attempt_id: int,
    payload: SpeakingGradeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SpeakingAttemptRead:
    return speaking_service.grade_attempt(db, current_user.id, attempt_id, payload.version)


@router.get("/attempts", response_model=SpeakingAttemptList)
def history(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> SpeakingAttemptList:
    return speaking_service.list_attempts(db, current_user.id)


@router.get("/attempts/{attempt_id}", response_model=SpeakingAttemptRead)
def read_attempt(
    attempt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SpeakingAttemptRead:
    return speaking_service.read_attempt(db, current_user.id, attempt_id)


@router.get("/usage", response_model=SpeakingUsageRead)
def usage(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> SpeakingUsageRead:
    return speaking_service.usage(db, current_user.id)
