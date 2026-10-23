from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictStr, field_validator


class FlashcardListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    position: int
    phrase: str
    meaning: str
    example_en: str | None
    example_vi: str | None
    is_weak: StrictBool
    is_bookmarked: StrictBool


class FlashcardWeakUpdate(BaseModel):
    """Set the persistent weak-card flag to an explicit value."""

    model_config = ConfigDict(extra="forbid")

    is_weak: StrictBool


class FlashcardBookmarkUpdate(BaseModel):
    """Set the persistent bookmark flag to an explicit value."""

    model_config = ConfigDict(extra="forbid")

    is_bookmarked: StrictBool


class FlashcardContentUpdate(BaseModel):
    """Update only the learner-facing phrase and meaning on an existing card."""

    model_config = ConfigDict(extra="forbid")

    phrase: StrictStr = Field(min_length=1, max_length=200)
    meaning: StrictStr = Field(min_length=1, max_length=600)

    @field_validator("phrase", "meaning", mode="before")
    @classmethod
    def trim_required_text(cls, value: object) -> object:
        # Trim at the API boundary so a value containing only whitespace cannot erase a card.
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError("This field cannot be empty.")
        return value
