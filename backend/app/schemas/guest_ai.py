from pydantic import BaseModel, ConfigDict, Field


class GuestStrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GuestWritingGrade(GuestStrictModel):
    prompt_id: int = Field(gt=0)
    draft_text: str = Field(min_length=1, max_length=4000)


class GuestSpeakingGrade(GuestStrictModel):
    prompt_id: int = Field(gt=0)
    transcript: str = Field(min_length=1, max_length=4000)


class GuestSentenceGrade(GuestStrictModel):
    phrase: str = Field(min_length=1, max_length=200)
    meaning: str = Field(min_length=1, max_length=600)
    situation_en: str = Field(min_length=5, max_length=500)
    situation_vi: str = Field(min_length=5, max_length=500)
    sentence: str = Field(min_length=1, max_length=1000)
