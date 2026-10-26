from pydantic import BaseModel, ConfigDict, Field, StrictStr, field_validator


class ReadingCategory(BaseModel):
    id: str
    name: str


class ReadingSource(BaseModel):
    id: str
    name: str
    categories: list[ReadingCategory]


class ReadingArticle(BaseModel):
    id: str
    source_id: str
    source_name: str
    category: str
    title: str
    summary: str
    url: str
    published_at: str | None = None
    image_url: str | None = None


class ReadingArticleList(BaseModel):
    articles: list[ReadingArticle]
    unavailable_sources: list[str] = Field(default_factory=list)


class ReadingArticleContent(BaseModel):
    article: ReadingArticle
    paragraphs: list[str]
    available: bool
    message: str | None = None


class ReadingLookupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: StrictStr = Field(min_length=1, max_length=500)

    @field_validator("text")
    @classmethod
    def trim_selection(cls, value: str) -> str:
        selected = value.strip()
        if not selected:
            raise ValueError("Select a word, phrase, or sentence to translate.")
        if len(selected.encode("utf-8")) > 500:
            raise ValueError("Please select a shorter passage (maximum 500 UTF-8 bytes).")
        return selected


class ReadingLookupResponse(BaseModel):
    text: str
    translation_vi: str


class ReadingVocabularySheet(BaseModel):
    id: int
    name: str
    workbook_id: int
    workbook_name: str
    card_count: int


class ReadingVocabularyCollection(BaseModel):
    sheets: list[ReadingVocabularySheet]


class ReadingVocabularyCardCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phrase: StrictStr = Field(min_length=1, max_length=200)
    meaning: StrictStr = Field(min_length=1, max_length=600)

    @field_validator("phrase", "meaning")
    @classmethod
    def trim_card_text(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("Phrase and meaning cannot be empty.")
        return text
