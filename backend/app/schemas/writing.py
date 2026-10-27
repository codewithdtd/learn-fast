from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class WritingPromptRead(StrictModel):
    id: int
    slug: str
    title_vi: str
    title_en: str
    prompt_vi: str
    prompt_en: str
    difficulty: str
    format: str
    target_word_count: int
    sentence_hints: list[dict[str, Any]]
    paragraph_hints: dict[str, Any]
    content_version: int
    is_daily_suggestion: bool = False


class WritingPromptList(StrictModel):
    items: list[WritingPromptRead]
    suggested_prompt_id: int | None


class AIWritingHint(StrictModel):
    idea_vi: str = Field(min_length=1, max_length=300)
    question_en: str = Field(min_length=1, max_length=300)
    frame_en: str = Field(min_length=1, max_length=300)


class AIBilingualItem(StrictModel):
    vi: str = Field(min_length=1, max_length=200)
    en: str = Field(min_length=1, max_length=200)


class AIWritingParagraphHints(StrictModel):
    opening_vi: str = Field(min_length=1, max_length=300)
    opening_en: str = Field(min_length=1, max_length=300)
    details_vi: str = Field(min_length=1, max_length=300)
    details_en: str = Field(min_length=1, max_length=300)
    closing_vi: str = Field(min_length=1, max_length=300)
    closing_en: str = Field(min_length=1, max_length=300)
    connectors: list[AIBilingualItem] = Field(min_length=3, max_length=5)
    vocabulary: list[AIBilingualItem] = Field(min_length=4, max_length=8)


class AIWritingPromptDraft(StrictModel):
    title_vi: str = Field(min_length=2, max_length=160)
    title_en: str = Field(min_length=2, max_length=160)
    prompt_vi: str = Field(min_length=10, max_length=1000)
    prompt_en: str = Field(min_length=10, max_length=1000)
    difficulty: Literal["basic"]
    format: Literal["paragraph"]
    target_word_count: int = Field(ge=60, le=120)
    sentence_hints: list[AIWritingHint] = Field(min_length=4, max_length=6)
    paragraph_hints: AIWritingParagraphHints


class AttemptCreate(StrictModel):
    prompt_id: int = Field(gt=0)
    revision_of_id: int | None = Field(default=None, gt=0)


class AttemptSave(StrictModel):
    version: int = Field(ge=1)
    draft_text: str = Field(max_length=4000)


class AttemptGrade(StrictModel):
    version: int = Field(ge=1)


class CriterionScore(StrictModel):
    score: float = Field(ge=0, le=10)
    explanation_vi: str = Field(min_length=1, max_length=700)
    explanation_en: str = Field(min_length=1, max_length=700)


class AIWritingIssue(StrictModel):
    id: str = Field(pattern=r"^E[1-9][0-9]*$", max_length=8)
    kind: Literal["error", "suggestion"]
    category: Literal[
        "grammar", "tense", "vocabulary", "word_order", "spelling_punctuation", "coherence"
    ]
    operation: Literal["replace", "delete", "insert"]
    quote: str = Field(min_length=1, max_length=120)
    occurrence: int = Field(ge=1, le=100)
    anchor_position: Literal["before", "after"] | None = None
    replacement: str = Field(default="", max_length=180)
    explanation_vi: str = Field(min_length=1, max_length=700)
    explanation_en: str = Field(min_length=1, max_length=700)
    rule_vi: str = Field(min_length=1, max_length=500)
    rule_en: str = Field(min_length=1, max_length=500)
    example_vi: str = Field(min_length=1, max_length=500)
    example_en: str = Field(min_length=1, max_length=500)


class AIWritingStrength(StrictModel):
    quote: str = Field(min_length=1, max_length=120)
    occurrence: int = Field(ge=1, le=100)
    note_vi: str = Field(min_length=1, max_length=300)
    note_en: str = Field(min_length=1, max_length=300)


class AIWritingFeedback(StrictModel):
    schema_version: Literal["1"]
    rubric_version: Literal["basic-v1"]
    task_response: CriterionScore
    coherence: CriterionScore
    vocabulary: CriterionScore
    grammar: CriterionScore
    summary_vi: str = Field(min_length=1, max_length=1000)
    summary_en: str = Field(min_length=1, max_length=1000)
    strengths: list[AIWritingStrength] = Field(default_factory=list, max_length=3)
    issues: list[AIWritingIssue] = Field(default_factory=list, max_length=40)
    next_steps: list[str] = Field(default_factory=list, max_length=3)


class WritingIssueRead(AIWritingIssue):
    start: int = Field(ge=0)
    end: int = Field(ge=0)


class WritingStrengthRead(AIWritingStrength):
    start: int = Field(ge=0)
    end: int = Field(ge=0)


class WritingFeedbackRead(StrictModel):
    schema_version: str
    rubric_version: str
    task_response: CriterionScore
    coherence: CriterionScore
    vocabulary: CriterionScore
    grammar: CriterionScore
    practice_score: float = Field(ge=0, le=10)
    summary_vi: str
    summary_en: str
    strengths: list[WritingStrengthRead]
    issues: list[WritingIssueRead]
    corrected_text: str
    next_steps: list[str]


class WritingAttemptSummary(StrictModel):
    id: int
    prompt_id: int
    title_en: str
    title_vi: str
    status: str
    word_count: int
    practice_score: float | None
    created_at: datetime
    graded_at: datetime | None
    revision_of_id: int | None


class WritingAttemptList(StrictModel):
    items: list[WritingAttemptSummary]
    total: int
    page: int
    page_size: int


class WritingErrorHistoryEntry(StrictModel):
    attempt_id: int
    title_en: str
    graded_at: datetime | None
    issues: list[WritingIssueRead]


class WritingErrorHistory(StrictModel):
    items: list[WritingErrorHistoryEntry]
    total: int
    page: int
    page_size: int


class WritingAttemptRead(StrictModel):
    id: int
    prompt_id: int
    prompt_snapshot: dict[str, Any]
    revision_of_id: int | None
    draft_text: str
    submitted_text: str | None
    word_count: int
    status: str
    version: int
    created_at: datetime
    updated_at: datetime
    submitted_at: datetime | None
    graded_at: datetime | None
    grading_expires_at: datetime | None = None
    feedback: WritingFeedbackRead | None
    error_code: str | None


class WritingUsageRead(StrictModel):
    usage_date: date
    daily_limit: int | None
    used: int
    remaining: int | None
