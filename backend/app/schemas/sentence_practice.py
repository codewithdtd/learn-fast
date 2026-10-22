from pydantic import ConfigDict, Field

from app.schemas.writing import StrictModel


class SentenceAttemptCreate(StrictModel):
    flashcard_id: int = Field(gt=0)


class SentenceBilingualHint(StrictModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    en: str = Field(min_length=1, max_length=500)
    vi: str = Field(min_length=1, max_length=500)


class AISentenceTask(StrictModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    prompt_en: str = Field(min_length=10, max_length=700)
    prompt_vi: str = Field(min_length=10, max_length=700)
    idea: SentenceBilingualHint
    frame: SentenceBilingualHint
    example: SentenceBilingualHint
