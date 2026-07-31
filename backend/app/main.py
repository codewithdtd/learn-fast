from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.flashcards import router as flashcards_router
from app.api.health import router as health_router
from app.api.quick_recall import router as quick_recall_router
from app.api.sheets import router as sheets_router
from app.api.study_sessions import router as study_sessions_router
from app.api.workbooks import router as workbooks_router
from app.core.config import settings


app = FastAPI(title="English SRS & Mastery Learning API")

# The browser treats the frontend and backend as separate origins in local
# development, so this explicit allow-list is required for the health request.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "PATCH"],
    allow_headers=["Content-Type"],
)

app.include_router(health_router, prefix="/api/v1")
app.include_router(workbooks_router, prefix="/api/v1")
app.include_router(sheets_router, prefix="/api/v1")
app.include_router(flashcards_router, prefix="/api/v1")
app.include_router(quick_recall_router, prefix="/api/v1")
app.include_router(study_sessions_router, prefix="/api/v1")
