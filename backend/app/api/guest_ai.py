from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.repositories.speaking import SpeakingRepository
from app.repositories.writing import WritingRepository
from app.schemas.guest_ai import GuestSentenceGrade, GuestSpeakingGrade, GuestWritingGrade
from app.schemas.speaking import SpeakingFeedback, SpeakingPromptDraft
from app.schemas.writing import AIWritingPromptDraft, WritingFeedbackRead
from app.services.guest_ai_quota import consume_guest_ai_trial
from app.services.speaking import _snapshot as speaking_snapshot
from app.services.speaking_ai import grade_speaking, generate_speaking_prompt
from app.services.writing import _prompt_snapshot
from app.services.writing_ai import generate_writing_prompt, grade_writing
from app.services.writing_feedback import validate_and_anchor_feedback
from app.schemas.paragraph_practice import ParagraphGuestGrade, ParagraphGuestTask, ParagraphPracticeCreate
from app.services.paragraph_practice import generate_task, select_words, task_snapshot

router = APIRouter(prefix="/guest/ai", tags=["guest AI trials"])


@router.post("/vocabulary-paragraph/topic", response_model=ParagraphGuestTask)
def vocabulary_paragraph_topic(payload: ParagraphPracticeCreate, request: Request, db: Session = Depends(get_db)) -> ParagraphGuestTask:
    words = select_words(db, payload, None)
    consume_guest_ai_trial(db, request, "vocabulary_paragraph_topic")
    return generate_task(words, payload.style, payload.sheet_id)


@router.post("/vocabulary-paragraph/grade", response_model=WritingFeedbackRead)
def vocabulary_paragraph_grade(payload: ParagraphGuestGrade, request: Request, db: Session = Depends(get_db)) -> WritingFeedbackRead:
    consume_guest_ai_trial(db, request, "vocabulary_paragraph_feedback")
    raw, _model = grade_writing(task_snapshot(payload.task), payload.draft_text)
    return validate_and_anchor_feedback(raw, payload.draft_text)


@router.post("/writing/topic", response_model=AIWritingPromptDraft)
def writing_topic(
    request: Request, db: Session = Depends(get_db)
) -> AIWritingPromptDraft:
    consume_guest_ai_trial(db, request, "writing_topic")
    return generate_writing_prompt()


@router.post("/writing/grade", response_model=WritingFeedbackRead)
def writing_grade(
    payload: GuestWritingGrade,
    request: Request,
    db: Session = Depends(get_db),
) -> WritingFeedbackRead:
    prompt = WritingRepository(db).get_prompt(payload.prompt_id)
    if prompt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Writing topic not found.")
    consume_guest_ai_trial(db, request, "writing_feedback")
    raw, _model = grade_writing(_prompt_snapshot(prompt), payload.draft_text)
    return validate_and_anchor_feedback(raw, payload.draft_text)


@router.post("/speaking/topic", response_model=SpeakingPromptDraft)
def speaking_topic(
    request: Request, db: Session = Depends(get_db)
) -> SpeakingPromptDraft:
    consume_guest_ai_trial(db, request, "speaking_topic")
    return generate_speaking_prompt()


@router.post("/speaking/grade", response_model=SpeakingFeedback)
def speaking_grade(
    payload: GuestSpeakingGrade,
    request: Request,
    db: Session = Depends(get_db),
) -> SpeakingFeedback:
    prompt = SpeakingRepository(db).get_prompt(payload.prompt_id)
    if prompt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Speaking topic not found.")
    consume_guest_ai_trial(db, request, "speaking_feedback")
    feedback, _model = grade_speaking(speaking_snapshot(prompt), payload.transcript)
    return feedback


@router.post("/sentence/grade", response_model=WritingFeedbackRead)
def sentence_grade(
    payload: GuestSentenceGrade,
    request: Request,
    db: Session = Depends(get_db),
) -> WritingFeedbackRead:
    consume_guest_ai_trial(db, request, "sentence_feedback")
    prompt = {
        "prompt_en": payload.situation_en,
        "prompt_vi": payload.situation_vi,
        "difficulty": "basic",
        "target_word_count": 1,
        "format": "sentence",
        "paragraph_hints": {"sentence_practice": {
            "phrase": payload.phrase,
            "meaning": payload.meaning,
            "situation_en": payload.situation_en,
            "situation_vi": payload.situation_vi,
        }},
    }
    raw, _model = grade_writing(prompt, payload.sentence)
    return validate_and_anchor_feedback(raw, payload.sentence)
