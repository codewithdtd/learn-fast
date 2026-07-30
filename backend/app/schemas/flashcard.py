from pydantic import BaseModel, ConfigDict


class FlashcardListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    position: int
    phrase: str
    meaning: str
    example_en: str | None
    example_vi: str | None
    is_weak: bool
    is_bookmarked: bool
