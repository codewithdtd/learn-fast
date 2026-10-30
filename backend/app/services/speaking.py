from datetime import datetime, timedelta, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.speaking_attempt import SpeakingAttempt
from app.models.speaking_prompt import SpeakingPrompt
from app.repositories.speaking import SpeakingRepository
from app.schemas.speaking import (
    SpeakingAttemptList,
    SpeakingAttemptRead,
    SpeakingAttemptSummary,
    SpeakingFeedback,
    SpeakingPromptList,
    SpeakingPromptRead,
    SpeakingUsageRead,
)
from app.services.speaking_ai import TranscriptionProviderError, generate_speaking_prompt, grade_speaking, transcribe_audio


def _snapshot(prompt: SpeakingPrompt) -> dict:
    return {
        "id": prompt.id, "slug": prompt.slug, "title_en": prompt.title_en, "title_vi": prompt.title_vi,
        "question_en": prompt.question_en, "question_vi": prompt.question_vi, "category": prompt.category,
        "difficulty": prompt.difficulty, "hints": prompt.hints,
    }


def _read(attempt: SpeakingAttempt) -> SpeakingAttemptRead:
    return SpeakingAttemptRead(
        id=attempt.id, prompt_id=attempt.prompt_id,
        prompt_snapshot=SpeakingPromptRead.model_validate(attempt.prompt_snapshot),
        transcript=attempt.transcript, status=attempt.status, version=attempt.version,
        quota_consumed=attempt.quota_consumed,
        created_at=attempt.created_at, updated_at=attempt.updated_at, graded_at=attempt.graded_at,
        feedback=SpeakingFeedback.model_validate(attempt.feedback_json) if attempt.feedback_json else None,
        error_code=attempt.error_code,
    )


def list_prompts(db: Session) -> SpeakingPromptList:
    return SpeakingPromptList(items=[SpeakingPromptRead.model_validate(_snapshot(prompt)) for prompt in SpeakingRepository(db).list_prompts()])


def create_attempt(db: Session, user_id: int, prompt_id: int) -> SpeakingAttemptRead:
    repo = SpeakingRepository(db)
    prompt = repo.get_prompt(prompt_id)
    if prompt is None:
        raise HTTPException(status_code=404, detail="Speaking topic not found.")
    return _read(repo.create_attempt(user_id, prompt, _snapshot(prompt)))


def generate_random_attempt(db: Session, user_id: int) -> SpeakingAttemptRead:
    repo = SpeakingRepository(db)
    try:
        draft = generate_speaking_prompt()
    except TranscriptionProviderError as error:
        raise HTTPException(status_code=error.status_code or 502, detail=str(error)) from error
    values = draft.model_dump()
    values["slug"] = f"ai-{uuid4().hex}"
    values["is_active"] = True
    prompt = repo.create_generated_prompt(values)
    # Lưu đề trước để attempt luôn có khóa ngoại hợp lệ và snapshot bền vững trong lịch sử.
    attempt = repo.create_attempt(user_id, prompt, _snapshot(prompt))
    return _read(attempt)


def _get_owned(repo: SpeakingRepository, user_id: int, attempt_id: int, *, lock: bool = False) -> SpeakingAttempt:
    attempt = repo.get_attempt(attempt_id, user_id, lock=lock)
    if attempt is None:
        raise HTTPException(status_code=404, detail="Speaking attempt not found.")
    return attempt


def transcribe(db: Session, user_id: int, attempt_id: int, audio: bytes, mime_type: str, *, is_admin: bool = False) -> SpeakingAttemptRead:
    repo = SpeakingRepository(db)
    attempt = _get_owned(repo, user_id, attempt_id, lock=True)
    if not audio:
        raise HTTPException(status_code=422, detail="The recording is empty.")
    if len(audio) > settings.speaking_max_audio_bytes:
        raise HTTPException(status_code=413, detail="The recording is too large. Keep it under 20 MB.")
    if mime_type not in {"audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/aac", "audio/m4a", "audio/opus"}:
        raise HTTPException(status_code=415, detail="This recording format is not supported. Please record again using the browser's default format.")
    today = datetime.now(ZoneInfo(settings.speaking_timezone)).date()
    # Admin không bị quota nội bộ chặn; provider vẫn áp dụng giới hạn riêng.
    quota = None if is_admin else max(1, settings.speaking_daily_ai_quota)
    claimed = repo.claim_transcription(attempt, quota, today, timedelta(seconds=300))
    if claimed is None:
        current = _get_owned(repo, user_id, attempt_id)
        if current.status == "transcribing":
            raise HTTPException(status_code=409, detail="Transcription is already in progress.")
        if quota is not None and repo.usage_count(user_id, today) >= quota and not current.quota_consumed:
            raise HTTPException(status_code=429, detail="Daily speaking practice limit reached.")
        raise HTTPException(status_code=409, detail="This recording cannot be transcribed in its current state.")
    try:
        # Safari records MP4 containers; Gemini expects the M4A MIME label for this payload family.
        provider_mime_type = "audio/m4a" if mime_type == "audio/mp4" else mime_type
        transcript = transcribe_audio(audio, provider_mime_type, f"speaking-attempt-{attempt_id}")
        if not transcript.strip() or len(transcript) > 4000:
            raise TranscriptionProviderError("No clear speech was detected. Please record a short answer and try again.")
    except TranscriptionProviderError as error:
        repo.fail(attempt_id, user_id, None, "provider_rate_limited" if error.status_code == 429 else "transcription_failed")
        raise HTTPException(status_code=429 if error.status_code == 429 else 502, detail=str(error)) from error
    except Exception as error:
        repo.fail(attempt_id, user_id, None, "transcription_failed")
        raise HTTPException(status_code=502, detail="Transcription failed. Your attempt is safe; please try again.") from error
    saved = repo.finish_transcription(attempt_id, user_id, transcript.strip())
    if saved is None:
        raise HTTPException(status_code=409, detail="This transcription could not be saved. Refresh the attempt and try again.")
    return _read(saved)


def save_transcript(db: Session, user_id: int, attempt_id: int, version: int, transcript: str) -> SpeakingAttemptRead:
    normalized = transcript.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized:
        raise HTTPException(status_code=422, detail="Transcript cannot be empty.")
    saved = SpeakingRepository(db).save_transcript(attempt_id, user_id, version, normalized)
    if saved is None:
        raise HTTPException(status_code=409, detail="This transcript changed or is still processing. Refresh the attempt before editing.")
    return _read(saved)


def grade_attempt(db: Session, user_id: int, attempt_id: int, version: int) -> SpeakingAttemptRead:
    repo = SpeakingRepository(db)
    attempt = _get_owned(repo, user_id, attempt_id)
    if attempt.status == "graded":
        return _read(attempt)
    claimed = repo.start_grading(attempt, version)
    if claimed is None:
        raise HTTPException(status_code=409, detail="Save the latest transcript before requesting feedback, or wait for the current review to finish.")
    token, _ = claimed
    try:
        feedback, model_name = grade_speaking(attempt.prompt_snapshot, attempt.transcript)
    except Exception as error:
        repo.fail(attempt_id, user_id, token, "grading_failed")
        if isinstance(error, TranscriptionProviderError):
            raise HTTPException(status_code=error.status_code or 502, detail=str(error)) from error
        raise HTTPException(status_code=502, detail="AI feedback could not be generated. Your transcript is saved; please try again.") from error
    saved = repo.complete_grade(attempt_id, user_id, token, feedback.model_dump(mode="json"), model_name)
    if saved is None:
        raise HTTPException(status_code=409, detail="The review expired before it could be saved. Your transcript remains available.")
    return _read(saved)


def read_attempt(db: Session, user_id: int, attempt_id: int) -> SpeakingAttemptRead:
    repo = SpeakingRepository(db)
    attempt = _get_owned(repo, user_id, attempt_id)
    repo.recover_stale([attempt], timedelta(seconds=300))
    db.refresh(attempt)
    return _read(attempt)


def list_attempts(db: Session, user_id: int) -> SpeakingAttemptList:
    repo = SpeakingRepository(db)
    items, total = repo.list_attempts(user_id)
    repo.recover_stale(items, timedelta(seconds=300))
    return SpeakingAttemptList(items=[SpeakingAttemptSummary(
        id=item.id, prompt_id=item.prompt_id, title_en=item.prompt_snapshot["title_en"],
        category=item.prompt_snapshot["category"], status=item.status,
        created_at=item.created_at, graded_at=item.graded_at,
    ) for item in items], total=total)


def usage(db: Session, user_id: int, *, is_admin: bool = False) -> SpeakingUsageRead:
    today = datetime.now(ZoneInfo(settings.speaking_timezone)).date()
    used = SpeakingRepository(db).usage_count(user_id, today)
    limit = None if is_admin else max(1, settings.speaking_daily_ai_quota)
    return SpeakingUsageRead(usage_date=today, daily_limit=limit, used=used, remaining=None if limit is None else max(0, limit - used))
