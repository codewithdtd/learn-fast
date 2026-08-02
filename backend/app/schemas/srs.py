from pydantic import BaseModel, ConfigDict

from app.models.enums import SrsRating
from app.schemas.sheet import SheetDetail
from app.schemas.study_session import StudySessionDetail


class StudySessionRatingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rating: SrsRating


class StudySessionRatingResponse(BaseModel):
    session: StudySessionDetail
    sheet: SheetDetail
