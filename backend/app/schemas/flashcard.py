from pydantic import BaseModel, ConfigDict, StrictBool


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
