from pydantic import ValidationError

from app.schemas.writing import (
    AIWritingFeedback,
    WritingFeedbackRead,
    WritingIssueRead,
    WritingStrengthRead,
)


class InvalidWritingFeedback(ValueError):
    """Raised when model feedback cannot be safely anchored to the submitted essay."""


def _find_occurrence(text: str, quote: str, occurrence: int) -> tuple[int, int]:
    """Resolve an exact quote on the frozen source; offsets use Python Unicode code points."""
    # Python index tính theo Unicode code point để offset trả về không lệch khi bài có emoji.
    found: list[int] = []
    cursor = 0
    while True:
        index = text.find(quote, cursor)
        if index < 0:
            break
        found.append(index)
        cursor = index + 1
    if occurrence > len(found):
        raise InvalidWritingFeedback("A feedback quote was not found in the submitted text.")
    start = found[occurrence - 1]
    return start, start + len(quote)


def _ranges_overlap(first: tuple[int, int], second: tuple[int, int]) -> bool:
    first_start, first_end = first
    second_start, second_end = second
    if first_start == first_end and second_start == second_end:
        return first_start == second_start
    if first_start == first_end:
        return second_start < first_start < second_end
    if second_start == second_end:
        return first_start < second_start < first_end
    return first_start < second_end and second_start < first_end


def validate_and_anchor_feedback(raw: object, source_text: str) -> WritingFeedbackRead:
    try:
        feedback = AIWritingFeedback.model_validate(raw)
    except ValidationError as error:
        raise InvalidWritingFeedback("The AI response did not match the writing feedback schema.") from error

    issue_rows: list[WritingIssueRead] = []
    ranges: list[tuple[int, int, str]] = []
    seen_ids: set[str] = set()
    for issue in feedback.issues:
        if issue.id in seen_ids:
            raise InvalidWritingFeedback("Feedback issue identifiers must be unique.")
        seen_ids.add(issue.id)
        if issue.operation == "insert" and issue.anchor_position is None:
            raise InvalidWritingFeedback("Insertion feedback must specify where text should be added.")
        if issue.operation != "insert" and issue.anchor_position is not None:
            raise InvalidWritingFeedback("Only insertion feedback can specify an anchor position.")
        start, end = _find_occurrence(source_text, issue.quote, issue.occurrence)
        if issue.operation == "insert":
            insertion_at = start if issue.anchor_position == "before" else end
            start = end = insertion_at
        issue_rows.append(WritingIssueRead(**issue.model_dump(), start=start, end=end))
        ranges.append((start, end, issue.id))

    for index, (first_start, first_end, _first_id) in enumerate(ranges):
        for second_start, second_end, _second_id in ranges[index + 1 :]:
            if _ranges_overlap((first_start, first_end), (second_start, second_end)):
                raise InvalidWritingFeedback("Feedback spans must not overlap.")

    strength_rows: list[WritingStrengthRead] = []
    error_ranges = [(item.start, item.end) for item in issue_rows if item.kind == "error"]
    for strength in feedback.strengths:
        start, end = _find_occurrence(source_text, strength.quote, strength.occurrence)
        if any(_ranges_overlap((start, end), error_range) for error_range in error_ranges):
            raise InvalidWritingFeedback("A strength highlight cannot cover an error.")
        strength_rows.append(WritingStrengthRead(**strength.model_dump(), start=start, end=end))

    # Chỉ áp dụng lỗi đã neo chính xác; suggestion không được tự ý thay câu vốn đúng của người học.
    corrected = source_text
    for issue in sorted(
        (item for item in issue_rows if item.kind == "error"),
        key=lambda item: (item.start, item.end),
        reverse=True,
    ):
        replacement = issue.replacement if issue.operation in {"replace", "insert"} else ""
        corrected = corrected[: issue.start] + replacement + corrected[issue.end :]

    scores = [
        feedback.task_response.score,
        feedback.coherence.score,
        feedback.vocabulary.score,
        feedback.grammar.score,
    ]
    average = round(sum(scores) / len(scores), 1)
    return WritingFeedbackRead(
        schema_version=feedback.schema_version,
        rubric_version=feedback.rubric_version,
        task_response=feedback.task_response,
        coherence=feedback.coherence,
        vocabulary=feedback.vocabulary,
        grammar=feedback.grammar,
        practice_score=average,
        summary_vi=feedback.summary_vi,
        summary_en=feedback.summary_en,
        strengths=strength_rows,
        issues=issue_rows,
        corrected_text=corrected,
        next_steps=feedback.next_steps,
    )
