import json

import pytest

from app.schemas.video_practice import TranscriptResponse, TranscriptSegment
from app.services.ielts_ai import generate_bundle, grade_question, validate_bundle
from app.services.ielts import SAMPLE_TEXT, public_attempt, sample_questions
from app.services.ielts_transcript_ticket import TranscriptTicketError, issue_transcript_ticket, verify_transcript_ticket


PASSAGE = "The council approved a new park near the river in May. " * 16


def bundle(skills: str = "reading", count: int = 5, video: bool = False) -> dict:
    def questions(skill: str) -> list[dict]:
        return [{
            "id": f"{skill}-{index}", "type": "multiple_choice",
            "prompt": f"What did the council approve in {skill} question {index}?",
            "options": [{"id": "A", "text": "A new park"}, {"id": "B", "text": "A new school"},
                        {"id": "C", "text": "A new hospital"}, {"id": "D", "text": "A new station"}],
            "correct_option_id": "A", "accepted_answers": [], "max_words": None,
            "evidence_quote": "The council approved a new park near the river in May.",
            "evidence_segment": 0 if video and skill == "listening" else None,
            "explanation_en": "The source explicitly says the council approved a park.",
            "explanation_vi": "Nguồn nói rõ hội đồng đã phê duyệt một công viên mới.",
            "distractor_explanations": {"B": "No school is approved.", "C": "No hospital is approved.", "D": "No station is approved."},
        } for index in range(count)]
    return {"reading": {"questions": questions("reading")} if skills in {"reading", "both"} else None,
            "listening": {"questions": questions("listening")} if skills in {"listening", "both"} else None}


def test_validator_requires_evidence_and_both_complete_skills() -> None:
    valid = bundle("both", video=True)
    segments = [{"text": PASSAGE, "start": 0, "duration": 60}]
    assert validate_bundle(json.dumps(valid), PASSAGE, segments, "both", 5)["listening"]
    valid["listening"]["questions"][0]["evidence_quote"] = "Never said in the recording."
    with pytest.raises(ValueError, match="Evidence quote"):
        validate_bundle(json.dumps(valid), PASSAGE, segments, "both", 5)
    valid["listening"] = None
    with pytest.raises(ValueError, match="every requested"):
        validate_bundle(json.dumps(valid), PASSAGE, segments, "both", 5)


def test_validator_scopes_question_ids_to_each_skill() -> None:
    valid = bundle("both", video=True)
    for index in range(5):
        valid["reading"]["questions"][index]["id"] = f"Q{index + 1}"
        valid["listening"]["questions"][index]["id"] = f"Q{index + 1}"
    segments = [{"text": PASSAGE, "start": 0, "duration": 60}]
    assert validate_bundle(json.dumps(valid), PASSAGE, segments, "both", 5)

    valid["reading"]["questions"][1]["id"] = valid["reading"]["questions"][0]["id"]
    with pytest.raises(ValueError, match="within each skill"):
        validate_bundle(json.dumps(valid), PASSAGE, segments, "both", 5)


def test_listening_rejects_true_false_not_given_with_actionable_reason() -> None:
    generated = bundle("listening", 5, video=True)
    question = generated["listening"]["questions"][0]
    question["type"] = "true_false_not_given"
    question["correct_option_id"] = None
    question["accepted_answers"] = ["TRUE"]
    question["evidence_quote"] = "The council approved a new park near the river in May."
    question["evidence_segment"] = 0
    segments = [{"text": PASSAGE, "start": 0, "duration": 60}]
    with pytest.raises(ValueError, match="listening question 1: True/False/Not Given is only allowed in Reading"):
        validate_bundle(json.dumps(generated), PASSAGE, segments, "listening", 5)


def test_reading_normalizes_video_segment_reference_without_losing_evidence() -> None:
    generated = bundle("reading", 5, video=True)
    generated["reading"]["questions"][0]["evidence_segment"] = 0
    result = validate_bundle(json.dumps(generated), PASSAGE, [{"text": PASSAGE}], "reading", 5)
    assert result["reading"]["questions"][0]["evidence_segment"] is None
    assert result["reading"]["questions"][0]["evidence_quote"] == generated["reading"]["questions"][0]["evidence_quote"]


def test_requested_skill_question_array_is_wrapped_and_still_validated() -> None:
    generated = bundle("both", 5, video=True)
    generated["reading"] = generated["reading"]["questions"]
    result = validate_bundle(json.dumps(generated), PASSAGE, [{"text": PASSAGE, "start": 0, "duration": 60}], "both", 5)
    assert len(result["reading"]["questions"]) == 5

    generated["reading"][0]["type"] = "invalid-type"
    with pytest.raises(ValueError, match="AI response schema invalid: reading.questions.0.type"):
        validate_bundle(json.dumps(generated), PASSAGE, [{"text": PASSAGE, "start": 0, "duration": 60}], "both", 5)


def test_repair_receives_schema_error_location_without_ai_values(monkeypatch, caplog) -> None:
    invalid = bundle("reading", 5)
    invalid["reading"]["questions"][0]["type"] = "private-generated-value"
    invalid["reading"]["questions"][0]["private-generated-field"] = "private-generated-value"
    responses = [json.dumps(invalid), json.dumps(bundle("reading", 5))]
    calls = []

    def fake_ai(messages, **_kwargs):
        calls.append(messages)
        return responses.pop(0)

    monkeypatch.setattr("app.services.ielts_ai.call_9router_chat", fake_ai)
    assert generate_bundle(PASSAGE, [], "reading", 5)["reading"]
    assert "reading.questions.0.type" in calls[1][-1]["content"]
    assert "literal_error" in calls[1][-1]["content"]
    assert "private-generated-value" not in caplog.text
    assert "private-generated-field" not in caplog.text


def test_option_maps_and_unused_ai_fields_are_normalized() -> None:
    generated = bundle("both", 5, video=True)
    first = generated["listening"]["questions"][0]
    first["options"] = {
        "A": {"text": "A new park", "unused_note": "private generated text"},
        "B": "A new school",
        "C": "A new hospital",
        "D": "A new station",
    }
    first["unused_note"] = "private generated text"
    second = generated["listening"]["questions"][1]
    second["options"] = ["A new park", "A new school", "A new hospital", "A new station"]

    result = validate_bundle(json.dumps(generated), PASSAGE, [{"text": PASSAGE, "start": 0, "duration": 60}], "both", 5)
    normalized = result["listening"]["questions"]
    assert normalized[0]["options"] == [
        {"id": "A", "text": "A new park"}, {"id": "B", "text": "A new school"},
        {"id": "C", "text": "A new hospital"}, {"id": "D", "text": "A new station"},
    ]
    assert normalized[1]["options"][3] == {"id": "D", "text": "A new station"}
    assert "unused_note" not in normalized[0]
    assert "unused_note" not in normalized[0]["options"][0]
    assert "private generated text" not in json.dumps(normalized)


def test_invalid_options_shape_reports_received_json_type() -> None:
    generated = bundle("listening", 5, video=True)
    generated["listening"]["questions"][0]["options"] = "not-an-array"
    with pytest.raises(ValueError, match=r"AI response schema invalid: listening\.questions\.0\.options \(list_type\): expected array, received string"):
        validate_bundle(json.dumps(generated), PASSAGE, [{"text": PASSAGE, "start": 0, "duration": 60}], "listening", 5)


def test_repair_explains_wrong_top_level_skill_shape(monkeypatch, caplog) -> None:
    invalid = bundle("both", 5, video=True)
    invalid["reading"] = "wrong-shape"
    responses = [json.dumps(invalid), json.dumps(bundle("both", 5, video=True))]
    calls = []

    def fake_ai(messages, **_kwargs):
        calls.append(messages)
        return responses.pop(0)

    monkeypatch.setattr("app.services.ielts_ai.call_9router_chat", fake_ai)
    assert generate_bundle(PASSAGE, [{"text": PASSAGE, "start": 0, "duration": 60}], "both", 5)["reading"]
    repair_prompt = calls[1][-1]["content"]
    assert "reading (model_type): expected object with questions array, received string" in repair_prompt
    assert "do not\nreturn null, a string, or an array directly for that skill" in repair_prompt
    assert "received string" in caplog.text


def test_generation_and_repair_prompts_include_strict_question_contract(monkeypatch, caplog) -> None:
    responses = ["not JSON", json.dumps(bundle("reading", 5))]
    calls: list[list[dict[str, str]]] = []

    def fake_ai(messages, response_metadata=None, **_kwargs):
        calls.append(messages)
        if response_metadata is not None:
            response_metadata.update({"finish_reason": "length", "completion_tokens": 4096})
        return responses.pop(0)

    monkeypatch.setattr("app.services.ielts_ai.call_9router_chat", fake_ai)
    assert generate_bundle(PASSAGE, [], "reading", 5)["reading"]

    system_prompt = calls[0][0]["content"]
    repair_prompt = calls[1][-1]["content"]
    assert "Listening may use only" in system_prompt
    assert "never use it for Listening" in system_prompt
    assert "TRUE means explicitly supported" in system_prompt
    assert '"reading":{"questions":[]}' in system_prompt
    assert '[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}]' in system_prompt
    assert "set evidence_segment to the zero-based index of the first segment" in system_prompt
    assert "verify: valid JSON; exact question counts" in system_prompt
    assert "explanation_en and" in system_prompt and "20 to 180 characters" in system_prompt
    assert "The previous response was not valid JSON" in repair_prompt
    assert "Expecting value" in repair_prompt and "response length 8 characters" in repair_prompt
    assert all(message["role"] != "assistant" for message in calls[1])
    assert "not JSON" not in repair_prompt
    assert "response_chars=8 finish_reason=length completion_tokens=4096" in caplog.text


def test_video_prompt_keeps_caption_index_outside_source_text(monkeypatch) -> None:
    captured = []
    monkeypatch.setattr(
        "app.services.ielts_ai.call_9router_chat",
        lambda messages, **_kwargs: captured.append(messages) or json.dumps(bundle("both", 5, video=True)),
    )
    generate_bundle(PASSAGE, [{"text": PASSAGE, "start": 0, "duration": 60}], "both", 5)
    system_prompt, user_prompt = captured[0][0]["content"], captured[0][1]["content"]
    assert "index is metadata; quote only text values" in user_prompt
    assert '"index": 0, "text": "The council approved' in user_prompt
    assert "index is metadata and must never" in system_prompt
    assert "[0] The council approved" not in user_prompt


def test_unique_quote_word_sequence_is_canonicalized_to_exact_source_slice() -> None:
    exact_quote = "The council approved a new park near the river in May."
    source = exact_quote + " " + ("The garden is open to visitors every day. " * 20)
    generated = bundle("reading", 5)
    generated["reading"]["questions"][0]["evidence_quote"] = exact_quote[:-1].lower()

    result = validate_bundle(json.dumps(generated), source, [], "reading", 5)
    assert result["reading"]["questions"][0]["evidence_quote"] == exact_quote[:-1]


def test_ambiguous_quote_word_sequence_is_not_canonicalized() -> None:
    generated = bundle("reading", 5)
    generated["reading"]["questions"][0]["evidence_quote"] = "the council approved a new park near the river in may"
    with pytest.raises(ValueError, match="normalized word sequence has 16 candidate locations"):
        validate_bundle(json.dumps(generated), PASSAGE, [], "reading", 5)


def test_listening_order_uses_the_selected_duplicate_quote_segment() -> None:
    segments = [
        {"start": 0, "duration": 5, "text": "A repeated quote appears here."},
        {"start": 5, "duration": 5, "text": "A separate clue supports the answer."},
        {"start": 10, "duration": 5, "text": "A repeated quote appears here."},
        {"start": 15, "duration": 5, "text": "Another detail appears later."},
        {"start": 20, "duration": 5, "text": "The final detail appears last."},
    ]
    source = " ".join(segment["text"] for segment in segments)
    generated = bundle("listening", 5, video=True)
    questions = generated["listening"]["questions"]
    evidence = [
        ("A separate clue supports the answer.", 1),
        ("A repeated quote appears here.", 2),
        ("Another detail appears later.", 3),
        ("The final detail appears last.", 4),
        ("The final detail appears last.", 4),
    ]
    for question, (quote, segment_index) in zip(questions, evidence, strict=True):
        question["evidence_quote"] = quote
        question["evidence_segment"] = segment_index
    assert validate_bundle(json.dumps(generated), source, segments, "listening", 5)


def test_listening_repairs_a_wrong_segment_index_when_quote_match_is_unique() -> None:
    segments = [
        {"start": 0, "duration": 5, "text": "The park opened in May."},
        {"start": 5, "duration": 5, "text": "Visitors can enter for free."},
        {"start": 10, "duration": 5, "text": "Local volunteers planted fifty trees."},
        {"start": 15, "duration": 5, "text": "The school will visit next month."},
        {"start": 20, "duration": 5, "text": "The council will review attendance."},
    ]
    source = " ".join(segment["text"] for segment in segments)
    generated = bundle("listening", 5, video=True)
    for index, question in enumerate(generated["listening"]["questions"]):
        question["evidence_quote"] = segments[index]["text"]
        question["evidence_segment"] = 0 if index == 1 else index

    result = validate_bundle(json.dumps(generated), source, segments, "listening", 5)
    assert result["listening"]["questions"][1]["evidence_segment"] == 1


def test_listening_accepts_a_quote_that_crosses_segment_boundaries() -> None:
    segments = [
        {"start": 0, "duration": 5, "text": "The river park"},
        {"start": 5, "duration": 5, "text": "opened in May."},
        {"start": 10, "duration": 5, "text": "Visitors enter for free."},
        {"start": 15, "duration": 5, "text": "The garden has flowers."},
        {"start": 20, "duration": 5, "text": "The cafe closes early."},
    ]
    source = " ".join(segment["text"] for segment in segments)
    generated = bundle("listening", 5, video=True)
    for index, question in enumerate(generated["listening"]["questions"]):
        quote_segment = min(index + 1, len(segments) - 1)
        question["evidence_quote"] = "park opened" if index == 0 else segments[quote_segment]["text"]
        question["evidence_segment"] = 0 if index == 0 else quote_segment

    result = validate_bundle(json.dumps(generated), source, segments, "listening", 5)
    first_question = result["listening"]["questions"][0]
    assert first_question["evidence_quote"] == "park opened"
    assert first_question["evidence_segment"] == 0
    assert first_question["evidence_segment_end"] == 1


def test_listening_replay_duration_covers_all_evidence_segments() -> None:
    segments = [
        {"start": 0, "duration": 4, "text": "First segment."},
        {"start": 4, "duration": 5, "text": "The river park"},
        {"start": 9, "duration": 6, "text": "opened in May."},
    ]
    question = {
        "id": "L1", "type": "multiple_choice", "prompt": "Where did the park open?",
        "options": [], "correct_option_id": "A", "accepted_answers": [], "max_words": None,
        "evidence_quote": "The river park opened in May.", "evidence_segment": 1,
        "evidence_segment_end": 2, "explanation_en": "The source names where the park opened.",
        "explanation_vi": "Nguồn cho biết công viên mở cửa ở đâu.", "distractor_explanations": {},
    }
    attempt = type("Attempt", (), {"id": 1, "test_set_id": 2, "skill": "listening", "status": "submitted",
                                   "answers_json": {"L1": "A"}, "score": 1})()
    test = type("TestSet", (), {"id": 2, "questions_json": {"listening": {"questions": [question]}}})()
    source = type("Source", (), {"reading_opened": False, "segments_json": segments})()

    review = public_attempt(attempt, test, source)["review"][0]
    assert review["evidence_start"] == 4
    assert review["evidence_duration"] == 11


@pytest.mark.parametrize(
    ("segment_index", "reason"),
    [(None, "index is missing"), (2, "outside the 1 available segments")],
)
def test_listening_evidence_reports_missing_or_out_of_range_index(segment_index, reason: str) -> None:
    generated = bundle("listening", 5, video=True)
    generated["listening"]["questions"][0]["evidence_segment"] = segment_index
    segments = [{"text": "The council approved a new park near the river in May."}]
    with pytest.raises(ValueError, match="listening question 1: Listening evidence segment") as error:
        validate_bundle(json.dumps(generated), PASSAGE, segments, "listening", 5)
    assert reason in str(error.value)


def test_invalid_ai_bundle_logs_validation_reason_without_source_text(monkeypatch, caplog) -> None:
    from fastapi import HTTPException

    private_source = "This source contains a private diagnostic phrase. " * 30
    monkeypatch.setattr("app.services.ielts_ai.call_9router_chat", lambda *_args, **_kwargs: "not JSON")
    with pytest.raises(HTTPException) as error:
        generate_bundle(private_source, [], "reading", 5)
    assert error.value.status_code == 502
    assert "phase=initial" in caplog.text and "phase=repair" in caplog.text
    assert "AI response is not valid JSON (Expecting value) at line 1, column 1; response length 8 characters." in caplog.text
    assert private_source not in caplog.text


def test_grading_preserves_spelling_and_numeric_punctuation() -> None:
    question = {"type": "completion", "max_words": 2, "accepted_answers": ["1.5 miles"]}
    assert grade_question(question, "  1.5   MILES ")
    assert not grade_question(question, "15 miles")
    assert not grade_question(question, "1.5 distant miles")


def test_sample_is_valid_and_free_to_open(api_client, monkeypatch) -> None:
    assert validate_bundle(json.dumps(sample_questions()), SAMPLE_TEXT, [], "reading", 5)
    monkeypatch.setattr("app.services.ielts.generate_bundle", lambda *_args: pytest.fail("Sample must not call AI"))
    headers = {"X-Guest-Token": "d" * 64}
    first = api_client.post("/api/v1/ielts/sample", headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["status"] == "ready"
    assert first.json()["questions"]["reading"][0]["type"] == "multiple_choice"
    assert "correct_option_id" not in first.text
    again = api_client.post("/api/v1/ielts/sample", headers=headers)
    assert again.json()["id"] == first.json()["id"]
    assert api_client.get("/api/v1/ielts/usage", headers=headers).json()["generation_used"] is False


def test_text_reading_keys_hidden_until_submission(admin_api_client, monkeypatch) -> None:
    monkeypatch.setattr("app.services.ielts.generate_bundle", lambda _text, _segments, skills, count: bundle(skills, count))
    source = admin_api_client.post("/api/v1/ielts/sources", json={"source_type": "text", "text": PASSAGE})
    assert source.status_code == 200, source.text
    source_id = source.json()["id"]
    invalid = admin_api_client.post("/api/v1/ielts/test-sets", json={"source_id": source_id, "skills": "both", "count_per_skill": 5, "idempotency_key": "wrong-skill-123"})
    assert invalid.status_code == 422
    created = admin_api_client.post("/api/v1/ielts/test-sets", json={"source_id": source_id, "skills": "reading", "count_per_skill": 5, "idempotency_key": "valid-reading-123"})
    assert created.status_code == 200, created.text
    test = created.json()
    assert "correct_option_id" not in created.text
    assert "explanation_en" not in created.text
    assert "listening" not in test["questions"]
    replay = admin_api_client.post("/api/v1/ielts/test-sets", json={"source_id": source_id, "skills": "reading", "count_per_skill": 5, "idempotency_key": "valid-reading-123"})
    assert replay.json()["id"] == test["id"]
    attempt = admin_api_client.post(f"/api/v1/ielts/test-sets/{test['id']}/attempts", json={"skill": "reading"}).json()
    assert "review" not in attempt
    saved = admin_api_client.patch(f"/api/v1/ielts/attempts/{attempt['id']}/answers", json={"answers": {"reading-0": "A", "reading-1": "B"}})
    assert saved.status_code == 200
    result = admin_api_client.post(f"/api/v1/ielts/attempts/{attempt['id']}/submit")
    assert result.status_code == 200
    assert result.json()["score"] == 1
    assert result.json()["review"][0]["explanation_vi"]
    assert admin_api_client.post(f"/api/v1/ielts/attempts/{attempt['id']}/submit").json()["score"] == 1
    assert admin_api_client.patch(f"/api/v1/ielts/attempts/{attempt['id']}/answers", json={"answers": {"reading-0": "B"}}).status_code == 409


def test_guest_ownership_and_one_generation_trial(api_client, monkeypatch) -> None:
    monkeypatch.setattr("app.services.ielts.generate_bundle", lambda _text, _segments, skills, count: bundle(skills, count))
    first = {"X-Guest-Token": "a" * 64}
    other = {"X-Guest-Token": "b" * 64}
    source_id = api_client.post("/api/v1/ielts/sources", headers=first, json={"source_type": "text", "text": PASSAGE}).json()["id"]
    test = api_client.post("/api/v1/ielts/test-sets", headers=first, json={"source_id": source_id, "skills": "reading", "count_per_skill": 5, "idempotency_key": "guest-first-123"})
    assert test.status_code == 200, test.text
    assert api_client.get(f"/api/v1/ielts/test-sets/{test.json()['id']}", headers=other).status_code == 404
    second_source = api_client.post("/api/v1/ielts/sources", headers=first, json={"source_type": "text", "text": PASSAGE}).json()["id"]
    second = api_client.post("/api/v1/ielts/test-sets", headers=first, json={"source_id": second_source, "skills": "reading", "count_per_skill": 5, "idempotency_key": "guest-second-123"})
    assert second.status_code == 429


def test_video_creates_two_sets_and_reveals_transcript_only_when_reading(api_client, monkeypatch) -> None:
    lines = [TranscriptSegment(start=i * 8, duration=8, text="The council approved a new park near the river in May.") for i in range(16)]
    monkeypatch.setattr("app.services.ielts.fetch_transcript", lambda _url, _lang: TranscriptResponse(
        video_id="abcdefghijk", title=None, author_name=None, language_code="en", caption_type="native", segments=lines))
    monkeypatch.setattr("app.services.ielts.generate_bundle", lambda source, segments, skills, count: bundle(skills, count, video=True))
    headers = {"X-Guest-Token": "c" * 64}
    source = api_client.post("/api/v1/ielts/sources", headers=headers, json={
        "source_type": "video", "video_url": "https://youtu.be/abcdefghijk", "start_seconds": 0, "end_seconds": 128})
    assert source.status_code == 200, source.text
    created = api_client.post("/api/v1/ielts/test-sets", headers=headers, json={"source_id": source.json()["id"], "count_per_skill": 5, "idempotency_key": "video-both-123"})
    assert created.status_code == 200, created.text
    assert set(created.json()["questions"]) == {"reading", "listening"}
    assert "The council approved" not in created.text
    video_id = created.json()["id"]
    passage = api_client.get(f"/api/v1/ielts/test-sets/{video_id}/reading", headers=headers)
    assert passage.status_code == 200
    assert "The council approved" in passage.json()["text"]
    assert api_client.get(f"/api/v1/ielts/test-sets/{video_id}", headers=headers).json()["source"]["reading_opened"]


def test_short_video_segment_does_not_consume_transcript_trial(api_client, monkeypatch) -> None:
    monkeypatch.setattr("app.services.ielts.fetch_transcript", lambda _url, _lang: TranscriptResponse(
        video_id="abcdefghijk", title=None, author_name=None, language_code="en", caption_type="native",
        segments=[TranscriptSegment(start=0, duration=20, text="Too short for a reliable practice test.")]))
    headers = {"X-Guest-Token": "e" * 64}
    result = api_client.post("/api/v1/ielts/sources", headers=headers, json={
        "source_type": "video", "video_url": "https://youtu.be/abcdefghijk", "start_seconds": 0, "end_seconds": 60})
    assert result.status_code == 422
    assert api_client.get("/api/v1/ielts/usage", headers=headers).json()["transcript_used"] is False


def test_signed_transcript_ticket_is_expiring_and_owner_bound() -> None:
    transcript = TranscriptResponse(video_id="abcdefghijk", title="Test", author_name=None,
                                    language_code="en", caption_type="native",
                                    segments=[TranscriptSegment(start=0, duration=8, text="A caption line.")])
    ticket = issue_transcript_ticket(transcript, "guest:owner-a")
    assert ticket
    assert verify_transcript_ticket(ticket, "guest:owner-a").video_id == transcript.video_id
    with pytest.raises(TranscriptTicketError) as wrong_owner:
        verify_transcript_ticket(ticket, "guest:owner-b")
    assert wrong_owner.value.status_code == 403
    with pytest.raises(TranscriptTicketError) as expired:
        verify_transcript_ticket(ticket, "guest:owner-a", now=10**12)
    assert expired.value.status_code == 410
    tampered = ticket[:-1] + ("A" if ticket[-1] != "A" else "B")
    with pytest.raises(TranscriptTicketError):
        verify_transcript_ticket(tampered, "guest:owner-a")


def test_video_practice_ticket_reuses_captions_without_second_provider_trial(api_client, monkeypatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "ytranscript_api_key", "test-key")
    lines = [TranscriptSegment(start=i * 8, duration=8, text=PASSAGE.strip()) for i in range(2)]
    transcript = TranscriptResponse(video_id="abcdefghijk", title="A practice video", author_name=None,
                                    language_code="en", caption_type="native", segments=lines)
    monkeypatch.setattr("app.api.video_practice.fetch_transcript", lambda *_args: transcript)
    headers = {"X-Guest-Token": "f" * 64}
    fetched = api_client.post("/api/v1/video-practice/transcript", headers=headers,
                              json={"video_url": "https://youtu.be/abcdefghijk", "language": "en"})
    assert fetched.status_code == 200, fetched.text
    ticket = fetched.json()["ielts_source_ticket"]
    assert ticket
    assert api_client.get("/api/v1/ielts/usage", headers=headers).json()["transcript_used"] is True

    def provider_must_not_run(*_args):
        pytest.fail("IELTS source creation should reuse the signed transcript ticket.")

    monkeypatch.setattr("app.services.ielts.fetch_transcript", provider_must_not_run)
    other_owner = api_client.post("/api/v1/ielts/sources", headers={"X-Guest-Token": "e" * 64}, json={
        "source_type": "video", "video_url": "https://youtu.be/abcdefghijk",
        "start_seconds": 0, "end_seconds": 60, "transcript_ticket": ticket,
    })
    assert other_owner.status_code == 403
    source = api_client.post("/api/v1/ielts/sources", headers=headers, json={
        "source_type": "video", "video_url": "https://youtu.be/abcdefghijk",
        "start_seconds": 0, "end_seconds": 60, "transcript_ticket": ticket,
    })
    assert source.status_code == 200, source.text
    assert source.json()["source_type"] == "video"


def test_practice_history_uses_owner_scoped_offset_pagination(admin_api_client, monkeypatch) -> None:
    monkeypatch.setattr("app.services.ielts.generate_bundle", lambda _text, _segments, skills, count: bundle(skills, count))
    tests = []
    for index in range(2):
        source = admin_api_client.post("/api/v1/ielts/sources", json={"source_type": "text", "text": PASSAGE})
        test = admin_api_client.post("/api/v1/ielts/test-sets", json={
            "source_id": source.json()["id"], "skills": "reading", "count_per_skill": 5,
            "idempotency_key": f"pagination-test-{index}",
        })
        tests.append(test.json())
    attempt_ids = []
    for test in tests:
        attempt = admin_api_client.post(f"/api/v1/ielts/test-sets/{test['id']}/attempts", json={"skill": "reading"})
        attempt_ids.append(attempt.json()["id"])

    first_sets = admin_api_client.get("/api/v1/ielts/test-sets?limit=1&offset=0").json()
    next_sets = admin_api_client.get("/api/v1/ielts/test-sets?limit=1&offset=1").json()
    assert first_sets["total"] == 2 and first_sets["has_more"] is True
    assert next_sets["total"] == 2 and next_sets["has_more"] is False
    assert first_sets["items"][0]["id"] != next_sets["items"][0]["id"]

    first_attempts = admin_api_client.get("/api/v1/ielts/attempts?limit=1&offset=0").json()
    next_attempts = admin_api_client.get("/api/v1/ielts/attempts?limit=1&offset=1").json()
    assert first_attempts["total"] == 2 and first_attempts["has_more"] is True
    assert next_attempts["total"] == 2 and next_attempts["has_more"] is False
    assert first_attempts["items"][0]["id"] != next_attempts["items"][0]["id"]
    assert set(attempt_ids) == {first_attempts["items"][0]["id"], next_attempts["items"][0]["id"]}
