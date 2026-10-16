from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SpeakingHint(StrictModel):
    en: str
    vi: str


class SpeakingPromptRead(StrictModel):
    id: int
    slug: str
    title_en: str
    title_vi: str
    question_en: str
    question_vi: str
    category: str
    difficulty: str
    hints: list[SpeakingHint]


class SpeakingPromptList(StrictModel):
    items: list[SpeakingPromptRead]


class SpeakingAttemptCreate(StrictModel):
    prompt_id: int = Field(gt=0)


class SpeakingTranscriptSave(StrictModel):
    version: int = Field(ge=1)
    transcript: str = Field(min_length=1, max_length=4000)


class SpeakingCriterion(StrictModel):
    score: float = Field(ge=0, le=10)
    feedback_en: str = Field(min_length=1, max_length=600)
    feedback_vi: str = Field(min_length=1, max_length=600)


class SpeakingExample(StrictModel):
    quote: str = Field(min_length=1, max_length=160)
    suggestion_en: str = Field(min_length=1, max_length=300)
    suggestion_vi: str = Field(min_length=1, max_length=300)
    reason_en: str = Field(min_length=1, max_length=500)
    reason_vi: str = Field(min_length=1, max_length=500)


class SpeakingBilingualText(StrictModel):
    en: str = Field(min_length=1, max_length=300)
    vi: str = Field(min_length=1, max_length=300)


class SpeakingFeedback(StrictModel):
    schema_version: Literal["1"]
    relevance: SpeakingCriterion
    coherence: SpeakingCriterion
    vocabulary: SpeakingCriterion
    grammar: SpeakingCriterion
    summary_en: str = Field(min_length=1, max_length=1000)
    summary_vi: str = Field(min_length=1, max_length=1000)
    strengths: list[SpeakingBilingualText] = Field(default_factory=list, max_length=4)
    improvements: list[SpeakingExample] = Field(default_factory=list, max_length=12)
    next_steps: list[SpeakingBilingualText] = Field(default_factory=list, max_length=4)


class SpeakingAttemptRead(StrictModel):
    id: int
    prompt_id: int
    prompt_snapshot: SpeakingPromptRead
    transcript: str
    status: str
    version: int
    quota_consumed: bool
    created_at: datetime
    updated_at: datetime
    graded_at: datetime | None
    feedback: SpeakingFeedback | None
    error_code: str | None


class SpeakingAttemptSummary(StrictModel):
    id: int
    prompt_id: int
    title_en: str
    category: str
    status: str
    created_at: datetime
    graded_at: datetime | None


class SpeakingAttemptList(StrictModel):
    items: list[SpeakingAttemptSummary]
    total: int


class SpeakingUsageRead(StrictModel):
    usage_date: date
    daily_limit: int
    used: int
    remaining: int


class SpeakingGradeRequest(StrictModel):
    version: int = Field(ge=1)
