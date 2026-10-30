from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_current_user_optional
from app.core.database import get_db
from app.models import User
from app.repositories.personal_library import get_user_vocabulary_sheet
from app.schemas.flashcard import FlashcardListItem
from app.schemas.reading import (
    ReadingArticle,
    ReadingArticleContent,
    ReadingArticleList,
    ReadingLookupRequest,
    ReadingLookupResponse,
    ReadingVocabularyCardCreate,
    ReadingVocabularyCollection,
    ReadingVocabularySheet,
    ReadingSource,
)
from app.services.flashcards import (
    FlashcardDuplicateError,
    FlashcardPersistenceError,
    StudySheetNotFoundError,
    create_flashcard as create_flashcard_service,
)
from app.services.news_provider import (
    NewsArticleUnavailable,
    NewsProviderError,
    SOURCE_FEEDS,
    fetch_news_article,
    fetch_news_articles,
    list_news_sources,
)
from app.services.reading import (
    ReadingLibraryPersistenceError,
    create_reading_vocabulary_sheet,
    list_reading_vocabulary_sheets,
)
from app.services.translation_provider import TranslationProviderError, translate_english_to_vietnamese
from app.services.video_practice import enforce_request_limit
from app.services.guest_ai_quota import provider_trial


router = APIRouter(prefix="/reading", tags=["reading"])


def _enforce_provider_limit(request: Request, user: User | None) -> None:
    if user is None or not user.is_superuser:
        enforce_request_limit(request.client.host if request.client else "unknown")


@router.get("/sources", response_model=list[ReadingSource])
def get_news_sources() -> list[ReadingSource]:
    return list_news_sources()


@router.get("/articles", response_model=ReadingArticleList)
def get_news_articles(
    request: Request,
    source: str = Query(default="all", max_length=20),
    category: str = Query(default="all", max_length=20),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> ReadingArticleList:
    _enforce_provider_limit(request, current_user)
    try:
        with provider_trial(db, request, "news_feed", current_user):
            return fetch_news_articles(source, category)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except NewsProviderError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error


@router.get("/articles/content", response_model=ReadingArticleContent)
def get_news_article_content(
    request: Request,
    source: str = Query(min_length=4, max_length=20),
    url: str = Query(min_length=12, max_length=2048),
    title: str = Query(default="", max_length=300),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> ReadingArticleContent:
    _enforce_provider_limit(request, current_user)
    source_config = SOURCE_FEEDS.get(source)
    if source_config is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Choose a supported news source.")
    article = ReadingArticle(
        id=f"{source}:{url}",
        source_id=source,
        source_name=str(source_config["name"]),
        category="News",
        title=title,
        summary="",
        url=url,
    )
    try:
        with provider_trial(db, request, "news_article", current_user):
            return fetch_news_article(source, article)
    except NewsArticleUnavailable as error:
        return ReadingArticleContent(article=article, paragraphs=[], available=False, message=str(error))


@router.post("/lookup", response_model=ReadingLookupResponse)
def lookup_reading_selection(payload: ReadingLookupRequest, request: Request, db: Session = Depends(get_db), current_user: User | None = Depends(get_current_user_optional)) -> ReadingLookupResponse:
    _enforce_provider_limit(request, current_user)
    try:
        with provider_trial(db, request, "translation_lookup", current_user):
            return ReadingLookupResponse(
                text=payload.text,
                translation_vi=translate_english_to_vietnamese(payload.text),
            )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except TranslationProviderError as error:
        headers = {"Retry-After": str(error.retry_after)} if error.retry_after is not None else None
        raise HTTPException(status_code=error.status_code, detail=str(error), headers=headers) from error


@router.get("/vocabulary-sheets", response_model=ReadingVocabularyCollection)
def get_vocabulary_sheets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReadingVocabularyCollection:
    return ReadingVocabularyCollection(sheets=list_reading_vocabulary_sheets(db, current_user.id))


@router.post("/vocabulary-sheets", response_model=ReadingVocabularySheet, status_code=status.HTTP_201_CREATED)
def create_vocabulary_sheet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReadingVocabularySheet:
    try:
        return create_reading_vocabulary_sheet(db, current_user.id)
    except ReadingLibraryPersistenceError as error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error


@router.post(
    "/vocabulary-sheets/{sheet_id}/cards",
    response_model=FlashcardListItem,
    status_code=status.HTTP_201_CREATED,
)
def save_reading_vocabulary(
    sheet_id: int,
    payload: ReadingVocabularyCardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FlashcardListItem:
    sheet = get_user_vocabulary_sheet(db, sheet_id, current_user.id)
    if sheet is None:
        # Trả 404 giống sheet không tồn tại để không làm lộ ID của thư viện riêng từ tài khoản khác.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary sheet not found.")
    try:
        card = create_flashcard_service(db, sheet.id, payload.phrase, payload.meaning, None, None)
    except StudySheetNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary sheet not found.") from error
    except FlashcardDuplicateError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except FlashcardPersistenceError as error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Vocabulary could not be saved. Please try again.") from error
    return FlashcardListItem.model_validate(card)
