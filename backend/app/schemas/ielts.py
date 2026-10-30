from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


Skill = Literal["reading", "listening"]
QuestionType = Literal["multiple_choice", "true_false_not_given", "completion"]


class SourceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_type: Literal["text", "video"]
    text: str | None = Field(default=None, max_length=16000)
    video_url: str | None = Field(default=None, max_length=2048)
    start_seconds: float | None = Field(default=None, ge=0)
    end_seconds: float | None = Field(default=None, gt=0)
    transcript_ticket: str | None = Field(default=None, max_length=100000)

    @model_validator(mode="after")
    def validate_source(self) -> "SourceCreate":
        if self.source_type == "text":
            if not self.text or not self.text.strip() or self.video_url or self.start_seconds is not None or self.end_seconds is not None or self.transcript_ticket:
                raise ValueError("Paste English text to create a Reading test.")
        elif not self.video_url or self.text or self.start_seconds is None or self.end_seconds is None or not 60 <= self.end_seconds - self.start_seconds <= 480:
            raise ValueError("Choose a YouTube video segment between 1 and 8 minutes.")
        return self


class TestSetCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_id: int = Field(gt=0)
    skills: Literal["reading", "listening", "both"] | None = None
    count_per_skill: Literal[5, 10] = 5
    idempotency_key: str = Field(min_length=8, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")


class Option(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=8)
    text: str = Field(min_length=1, max_length=300)


class GeneratedQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=30)
    type: QuestionType
    prompt: str = Field(min_length=8, max_length=500)
    options: list[Option] = Field(default_factory=list, max_length=4)
    correct_option_id: str | None = None
    accepted_answers: list[str] = Field(default_factory=list, max_length=4)
    max_words: int | None = Field(default=None, ge=1, le=3)
    evidence_quote: str = Field(default="", max_length=500)
    evidence_segment: int | None = Field(default=None, ge=0)
    evidence_segment_end: int | None = Field(default=None, ge=0)
    explanation_en: str = Field(min_length=20, max_length=1200)
    explanation_vi: str = Field(min_length=20, max_length=1200)
    distractor_explanations: dict[str, str] = Field(default_factory=dict)


class GeneratedTest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    questions: list[GeneratedQuestion] = Field(min_length=1, max_length=10)


class GeneratedBundle(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reading: GeneratedTest | None = None
    listening: GeneratedTest | None = None


class AnswersUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answers: dict[str, str] = Field(max_length=10)


class AttemptStart(BaseModel):
    model_config = ConfigDict(extra="forbid")
    skill: Skill

