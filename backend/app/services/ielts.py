from fastapi import HTTPException, Request
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.ielts_attempt import IELTSPracticeAttempt
from app.models.ielts_source import IELTSPracticeSource
from app.models.ielts_test_set import IELTSPracticeTestSet
from app.models.mixins import utc_now
from app.models.user import User
from app.repositories.ielts import IELTSRepository
from app.schemas.ielts import AnswersUpdate, SourceCreate, TestSetCreate
from app.services.guest_ai_quota import guest_key_hash_from_request, provider_trial
from app.services.ielts_ai import generate_bundle, grade_question, public_question
from app.services.ielts_transcript_ticket import TranscriptTicketError, transcript_owner_key, verify_transcript_ticket
from app.services.transcript_provider import VideoPracticeProviderError, fetch_transcript
from app.services.transcript_provider import extract_youtube_video_id


SAMPLE_TEXT = """In May, the town council opened a new community park beside the river. Entry to the park is free for everyone. The park has walking paths, a small garden, and an outdoor reading area. Local volunteers planted more than fifty trees before the opening day. The council says the new trees will provide shade during the warmer months.

The park opens at seven in the morning and closes at six in the evening from Monday to Saturday. It is closed on Sundays so staff can maintain the paths and garden. Visitors are asked to take their rubbish home, because the park does not yet have enough bins. A local school plans to hold a nature class there next month, and several residents have offered to help the class.

The council will review how people use the park at the end of the year. It may add more seating if many visitors use the reading area. No decision about new facilities has been made yet."""


def sample_questions() -> dict:
    # Bài mẫu cố định cho phép nhà tuyển dụng xem UX mà không tiêu quota provider.
    return {"reading": {"questions": [
        {"id": "sample-1", "type": "multiple_choice", "prompt": "Where is the new community park?",
         "options": [{"id": "A", "text": "Beside the river"}, {"id": "B", "text": "Inside the school"},
                     {"id": "C", "text": "Near the station"}, {"id": "D", "text": "Behind the council office"}],
         "correct_option_id": "A", "accepted_answers": [], "max_words": None,
         "evidence_quote": "the town council opened a new community park beside the river", "evidence_segment": None,
         "explanation_en": "The first sentence places the park beside the river. Look for the location phrase after 'park'.",
         "explanation_vi": "Câu đầu tiên cho biết công viên nằm cạnh dòng sông. Hãy tìm cụm chỉ vị trí ngay sau từ 'park'.",
         "distractor_explanations": {"B": "The school plans a class there; the park is not inside it.", "C": "No station is mentioned.", "D": "The council opened the park, but its office is not given as a location."}},
        {"id": "sample-2", "type": "true_false_not_given", "prompt": "Visitors have to pay to enter the park.",
         "options": [], "correct_option_id": None, "accepted_answers": ["FALSE"], "max_words": None,
         "evidence_quote": "Entry to the park is free for everyone.", "evidence_segment": None,
         "explanation_en": "The statement says visitors pay, while the passage explicitly says entry is free. This is False rather than Not Given.",
         "explanation_vi": "Nhận định nói khách phải trả tiền, nhưng bài viết khẳng định vào cửa miễn phí. Đây là False chứ không phải Not Given.",
         "distractor_explanations": {}},
        {"id": "sample-3", "type": "completion", "prompt": "Who planted more than fifty trees before opening day?",
         "options": [], "correct_option_id": None, "accepted_answers": ["volunteers"], "max_words": 1,
         "evidence_quote": "Local volunteers planted more than fifty trees before the opening day.", "evidence_segment": None,
         "explanation_en": "The subject of 'planted' is 'Local volunteers'. The one-word answer is volunteers.",
         "explanation_vi": "Chủ ngữ của động từ 'planted' là 'Local volunteers'. Đáp án một từ là volunteers.",
         "distractor_explanations": {}},
        {"id": "sample-4", "type": "true_false_not_given", "prompt": "The park is open every Sunday.",
         "options": [], "correct_option_id": None, "accepted_answers": ["FALSE"], "max_words": None,
         "evidence_quote": "It is closed on Sundays so staff can maintain the paths and garden.", "evidence_segment": None,
         "explanation_en": "The passage explicitly says the park is closed on Sundays, contradicting 'open every Sunday'.",
         "explanation_vi": "Bài viết nói rõ công viên đóng cửa vào Chủ nhật, trái với nhận định mở cửa vào mọi Chủ nhật.",
         "distractor_explanations": {}},
        {"id": "sample-5", "type": "true_false_not_given", "prompt": "Visitors may bring their bicycles into the park.",
         "options": [], "correct_option_id": None, "accepted_answers": ["NOT GIVEN"], "max_words": None,
         "evidence_quote": "", "evidence_segment": None,
         "explanation_en": "The passage gives no rule about bicycles. There is not enough information to decide whether they are allowed.",
         "explanation_vi": "Bài đọc không nêu quy định về xe đạp. Không đủ thông tin để kết luận xe đạp có được phép vào công viên hay không.",
         "distractor_explanations": {}},
    ]}, "listening": None}


def create_sample(db: Session, request: Request, user: User | None) -> dict:
    owner_id, guest_hash = owner(request, user)
    repository = IELTSRepository(db)
    existing = db.scalar(select(IELTSPracticeTestSet).join(IELTSPracticeSource).where(
        repository.scope(IELTSPracticeSource, owner_id, guest_hash),
        IELTSPracticeSource.title == "Sample: Community Park",
        IELTSPracticeTestSet.idempotency_key == "sample-v1",
    ))
    if existing:
        return public_set(existing, require_source(db, existing.source_id, owner_id, guest_hash))
    source = IELTSPracticeSource(user_id=owner_id, guest_key_hash=guest_hash, source_type="text",
                                 title="Sample: Community Park", source_text=SAMPLE_TEXT, segments_json=[])
    db.add(source)
    db.flush()
    test = IELTSPracticeTestSet(source_id=source.id, idempotency_key="sample-v1", skills="reading",
                               count_per_skill=5, status="ready", questions_json=sample_questions())
    db.add(test)
    db.commit()
    db.refresh(test)
    return public_set(test, source)


def owner(request: Request, user: User | None) -> tuple[int | None, str | None]:
    return (user.id, None) if user is not None else (None, guest_key_hash_from_request(request))


def require_source(db: Session, source_id: int, owner_id: int | None, guest_hash: str | None) -> IELTSPracticeSource:
    source = IELTSRepository(db).source(source_id, owner_id, guest_hash)
    if source is None:
        raise HTTPException(status_code=404, detail="Practice source was not found.")
    return source


def require_set(db: Session, test_id: int, owner_id: int | None, guest_hash: str | None) -> tuple[IELTSPracticeTestSet, IELTSPracticeSource]:
    result = IELTSRepository(db).test_set(test_id, owner_id, guest_hash)
    if result is None:
        raise HTTPException(status_code=404, detail="Practice test was not found.")
    return result


def require_attempt(db: Session, attempt_id: int, owner_id: int | None, guest_hash: str | None):
    result = IELTSRepository(db).attempt(attempt_id, owner_id, guest_hash)
    if result is None:
        raise HTTPException(status_code=404, detail="Practice attempt was not found.")
    return result


def create_source(db: Session, request: Request, user: User | None, payload: SourceCreate) -> dict:
    owner_id, guest_hash = owner(request, user)
    repository = IELTSRepository(db)
    repository.clean_expired_guest_sources()
    if not (user and user.is_superuser) and repository.count_sources(owner_id, guest_hash) >= 5:
        raise HTTPException(status_code=429, detail="You have reached the limit of five practice sources.")
    if payload.source_type == "text":
        source_text = payload.text.strip()
        segments: list[dict] = []
        video_id = None
    else:
        def prepare_video_source(transcript):
            if transcript.language_code and not transcript.language_code.lower().startswith("en"):
                raise HTTPException(status_code=422, detail="This video does not have English captions.")
            selected_segments = [segment for segment in transcript.segments if payload.start_seconds <= segment.start < payload.end_seconds]
            selected_text = " ".join(segment.text for segment in selected_segments)
            if not 150 <= len(selected_text.split()) <= 2000:
                raise HTTPException(status_code=422, detail="Choose a video segment with 150–2,000 English words.")
            return transcript.video_id, [segment.model_dump() for segment in selected_segments], selected_text

        try:
            if payload.transcript_ticket:
                # Chỉ tái sử dụng transcript do server ký, gắn đúng chủ sở hữu và đúng video YouTube.
                transcript = verify_transcript_ticket(payload.transcript_ticket, transcript_owner_key(request, user))
                requested_video_id = extract_youtube_video_id(payload.video_url)
                if transcript.video_id != requested_video_id:
                    raise HTTPException(status_code=422, detail="The transcript ticket does not match this YouTube video.")
                video_id, segments, source_text = prepare_video_source(transcript)
            else:
                with provider_trial(db, request, "video_transcript", user):
                    transcript = fetch_transcript(payload.video_url, "en")
                    # Kiểm tra trong phạm vi trial để hoàn lượt nếu transcript không đủ điều kiện luyện tập.
                    video_id, segments, source_text = prepare_video_source(transcript)
        except VideoPracticeProviderError as error:
            raise HTTPException(status_code=error.status_code, detail=str(error)) from error
        except TranscriptTicketError as error:
            raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    words = len(source_text.split())
    if not 150 <= words <= 2000:
        raise HTTPException(status_code=422, detail="Choose an English source between 150 and 2,000 words.")
    source = IELTSPracticeSource(
        user_id=owner_id, guest_key_hash=guest_hash, source_type=payload.source_type,
        title=(source_text.split(".", 1)[0].strip()[:80] or "Your passage") if payload.source_type == "text" else f"YouTube clip {video_id}",
        source_text=source_text, segments_json=segments, video_id=video_id,
        start_seconds=payload.start_seconds, end_seconds=payload.end_seconds,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source_summary(source)


def source_summary(source: IELTSPracticeSource) -> dict:
    return {"id": source.id, "source_type": source.source_type, "title": source.title,
            "word_count": len(source.source_text.split()), "video_id": source.video_id,
            "start_seconds": source.start_seconds, "end_seconds": source.end_seconds,
            "reading_opened": source.reading_opened}


def public_set(test: IELTSPracticeTestSet, source: IELTSPracticeSource) -> dict:
    questions = test.questions_json or {}
    return {"id": test.id, "source": source_summary(source), "status": test.status,
            "skills": test.skills, "count_per_skill": test.count_per_skill, "error_code": test.error_code,
            "questions": {skill: [public_question(q) for q in questions[skill]["questions"]]
                          for skill in ("reading", "listening") if questions.get(skill)}}


def create_test_set(db: Session, request: Request, user: User | None, payload: TestSetCreate) -> dict:
    owner_id, guest_hash = owner(request, user)
    source = require_source(db, payload.source_id, owner_id, guest_hash)
    skills = payload.skills or ("both" if source.source_type == "video" else "reading")
    if source.source_type == "text" and skills != "reading":
        raise HTTPException(status_code=422, detail="Pasted text can only create a Reading test.")
    if payload.count_per_skill == 10 and len(source.source_text.split()) < 350:
        raise HTTPException(status_code=422, detail="Choose a longer source for 10 questions per skill.")
    existing = db.scalar(select(IELTSPracticeTestSet).where(
        IELTSPracticeTestSet.source_id == source.id,
        IELTSPracticeTestSet.idempotency_key == payload.idempotency_key,
    ))
    if existing:
        if existing.skills != skills or existing.count_per_skill != payload.count_per_skill:
            raise HTTPException(status_code=409, detail="This request key was already used for different settings.")
        return public_set(existing, source)
    test = IELTSPracticeTestSet(source_id=source.id, idempotency_key=payload.idempotency_key,
                               skills=skills, count_per_skill=payload.count_per_skill)
    db.add(test)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Unique(source, key) protects concurrent requests after the initial read.
        existing = db.scalar(select(IELTSPracticeTestSet).where(
            IELTSPracticeTestSet.source_id == source.id,
            IELTSPracticeTestSet.idempotency_key == payload.idempotency_key,
        ))
        if existing is None:
            raise
        return public_set(existing, source)
    db.refresh(test)
    try:
        with provider_trial(db, request, "ielts_test_generation", user):
            generated = generate_bundle(source.source_text, source.segments_json, skills, payload.count_per_skill)
            IELTSRepository(db).finish_generation(test.id, generated)
    except HTTPException as error:
        test.status = "failed"
        test.error_code = "provider_rate_limited" if error.status_code == 429 else "generation_failed"
        db.commit()
        raise
    except Exception as error:
        test.status = "failed"
        test.error_code = "generation_failed"
        db.commit()
        raise HTTPException(status_code=502, detail="The practice test could not be generated. Please try another source.") from error
    db.refresh(test)
    return public_set(test, source)


def _evidence_playback_range(question: dict, segments: list[dict]) -> tuple[float | None, float | None]:
    first_index = question.get("evidence_segment")
    if first_index is None or not 0 <= first_index < len(segments):
        return None, None
    last_index = question.get("evidence_segment_end")
    if last_index is None or not first_index <= last_index < len(segments):
        last_index = first_index
    # Quote có thể đi qua nhiều caption segment; replay phải bao phủ toàn khoảng để người học nghe đủ bằng chứng.
    playback_start = segments[first_index]["start"]
    playback_end = segments[last_index]["start"] + segments[last_index]["duration"]
    return playback_start, max(0, playback_end - playback_start)


def public_attempt(attempt: IELTSPracticeAttempt, test: IELTSPracticeTestSet, source: IELTSPracticeSource) -> dict:
    questions = test.questions_json[attempt.skill]["questions"]
    result = {"id": attempt.id, "test_set_id": test.id, "skill": attempt.skill,
              "status": attempt.status, "answers": attempt.answers_json, "score": attempt.score,
              "total": len(questions), "reading_opened": source.reading_opened}
    if attempt.status == "submitted":
        review = []
        for question in questions:
            evidence_start, evidence_duration = _evidence_playback_range(question, source.segments_json or [])
            review.append({"id": question["id"], "correct": grade_question(question, attempt.answers_json.get(question["id"], "")),
                           "answer": question.get("correct_option_id") or question["accepted_answers"][0],
                           "accepted_answers": question["accepted_answers"], "evidence_quote": question["evidence_quote"],
                           "evidence_segment": question["evidence_segment"], "evidence_start": evidence_start,
                           "evidence_duration": evidence_duration,
                           "explanation_en": question["explanation_en"], "explanation_vi": question["explanation_vi"],
                           "distractor_explanations": question["distractor_explanations"]})
        result["review"] = review
    return result


def save_answers(db: Session, attempt: IELTSPracticeAttempt, test: IELTSPracticeTestSet, payload: AnswersUpdate) -> None:
    ids = {q["id"] for q in test.questions_json[attempt.skill]["questions"]}
    if set(payload.answers) - ids or any(len(answer) > 500 for answer in payload.answers.values()):
        raise HTTPException(status_code=422, detail="Answers contain an unknown question or exceed the limit.")
    # Điều kiện trạng thái trong SQL ngăn request lưu nháp đến muộn sửa đáp án đã chấm.
    changed = db.execute(update(IELTSPracticeAttempt).where(
        IELTSPracticeAttempt.id == attempt.id, IELTSPracticeAttempt.status == "draft",
    ).values(answers_json=dict(payload.answers), updated_at=utc_now()))
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="This attempt has already been submitted.")
    db.commit()


def submit_attempt(db: Session, attempt: IELTSPracticeAttempt, test: IELTSPracticeTestSet) -> None:
    # Chờ PATCH đang ghi xong rồi lấy đáp án mới nhất trước khi chấm.
    db.refresh(attempt, with_for_update=True)
    if attempt.status == "submitted":
        return
    questions = test.questions_json[attempt.skill]["questions"]
    score = sum(grade_question(q, attempt.answers_json.get(q["id"], "")) for q in questions)
    IELTSRepository(db).submit(attempt.id, score)
