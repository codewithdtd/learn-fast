import re

from pydantic import BaseModel, ConfigDict, Field, StrictStr, field_validator


class TranscriptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    video_url: StrictStr = Field(min_length=8, max_length=2048)
    language: StrictStr = Field(default="en", min_length=2, max_length=12)

    @field_validator("language")
    @classmethod
    def normalize_language(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[a-z]{2,3}(?:-[a-z0-9]{2,8})*", normalized):
            raise ValueError("Language code is invalid.")
        return normalized


class TranscriptSegment(BaseModel):
    start: float = Field(ge=0)
    duration: float = Field(gt=0, le=120)
    text: str = Field(min_length=1, max_length=1000)


class TranscriptResponse(BaseModel):
    video_id: str
    title: str | None = None
    author_name: str | None = None
    language_code: str | None = None
    caption_type: str | None = None
    segments: list[TranscriptSegment] = Field(min_length=1, max_length=1000)
    # Ticket ký ngắn hạn giúp chuyển transcript sang IELTS mà không phải gọi lại provider.
    ielts_source_ticket: str | None = None


class WordLookupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    term: StrictStr = Field(min_length=1, max_length=500)
    context: StrictStr | None = Field(default=None, max_length=500)

    @field_validator("term", "context", mode="before")
    @classmethod
    def trim_text(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class DictionaryDefinition(BaseModel):
    part_of_speech: str | None = None
    definition: str
    example: str | None = None


class WordLookupResponse(BaseModel):
    term: str
    translation_vi: str | None = None
    phonetic: str | None = None
    audio_url: str | None = None
    definitions: list[DictionaryDefinition] = Field(default_factory=list)
    translation_error: str | None = None
    translation_retry_after: int | None = Field(default=None, ge=1)
