import pytest

from app.services.writing_feedback import InvalidWritingFeedback, validate_and_anchor_feedback


def criterion(score: float = 8) -> dict:
    return {"score": score, "explanation_vi": "Rõ ý.", "explanation_en": "Clear idea."}


def valid_feedback(issues: list[dict] | None = None, strengths: list[dict] | None = None) -> dict:
    issue_template = {
        "id": "E1", "kind": "error", "category": "grammar", "operation": "replace",
        "quote": "I lives", "occurrence": 1, "replacement": "I live",
        "explanation_vi": "Chia động từ theo chủ ngữ.", "explanation_en": "Match the verb to the subject.",
        "rule_vi": "I đi với động từ nguyên mẫu.", "rule_en": "Use the base verb with I.",
        "example_vi": "Tôi sống ở đây.", "example_en": "I live here.",
    }
    return {
        "schema_version": "1", "rubric_version": "basic-v1",
        "task_response": criterion(), "coherence": criterion(),
        "vocabulary": criterion(), "grammar": criterion(6),
        "summary_vi": "Đoạn viết dễ hiểu.", "summary_en": "The paragraph is easy to understand.",
        "strengths": strengths or [], "issues": issues if issues is not None else [issue_template],
        "next_steps": ["Practise subject-verb agreement."],
    }


def test_anchor_and_correct_exact_source_span() -> None:
    source = "I lives in a small home. I like it."
    result = validate_and_anchor_feedback(valid_feedback(), source)

    issue = result.issues[0]
    assert source[issue.start : issue.end] == "I lives"
    assert issue.start == 0
    assert result.practice_score == 7.5
    assert result.corrected_text == "I live in a small home. I like it."


def test_repeated_quotes_use_the_requested_occurrence() -> None:
    feedback = valid_feedback()
    feedback["issues"][0]["quote"] = "I"
    feedback["issues"][0]["occurrence"] = 2
    result = validate_and_anchor_feedback(feedback, "I live here. I study English.")
    assert result.issues[0].start == 13


def test_insert_is_anchored_without_using_an_empty_quote() -> None:
    issue = valid_feedback()["issues"][0]
    issue.update({"operation": "insert", "quote": "live", "anchor_position": "after", "replacement": " every day"})
    result = validate_and_anchor_feedback({**valid_feedback(), "issues": [issue]}, "I live here.")
    assert result.issues[0].start == result.issues[0].end == 6
    assert result.corrected_text == "I live every day here."


def test_delete_operation_removes_only_the_error_span() -> None:
    issue = valid_feedback()["issues"][0]
    issue.update({"operation": "delete", "quote": "very", "replacement": ""})
    result = validate_and_anchor_feedback({**valid_feedback(), "issues": [issue]}, "It is very nice.")
    assert result.corrected_text == "It is  nice."


def test_correct_sentence_can_have_no_issues_and_keeps_its_text() -> None:
    result = validate_and_anchor_feedback(valid_feedback(issues=[]), "I live in a small home.")
    assert result.issues == []
    assert result.corrected_text == "I live in a small home."


def test_missing_quote_is_rejected_instead_of_returning_false_highlight() -> None:
    with pytest.raises(InvalidWritingFeedback):
        validate_and_anchor_feedback(valid_feedback(), "I live in a small home.")


def test_overlapping_edits_are_rejected() -> None:
    first = valid_feedback()["issues"][0]
    second = {**first, "id": "E2", "quote": "lives in", "occurrence": 1}
    with pytest.raises(InvalidWritingFeedback, match="overlap"):
        validate_and_anchor_feedback({**valid_feedback(), "issues": [first, second]}, "I lives in a home.")


def test_strength_cannot_be_highlighted_over_an_error() -> None:
    strength = {"quote": "I lives", "occurrence": 1, "note_vi": "Câu rõ.", "note_en": "Clear sentence."}
    with pytest.raises(InvalidWritingFeedback, match="strength"):
        validate_and_anchor_feedback(valid_feedback(strengths=[strength]), "I lives here.")


def test_unicode_offsets_use_python_code_points() -> None:
    issue = valid_feedback()["issues"][0]
    issue["quote"] = "I lives"
    result = validate_and_anchor_feedback({**valid_feedback(), "issues": [issue]}, "😀 I lives here.")
    assert "😀 I lives here."[result.issues[0].start : result.issues[0].end] == "I lives"
