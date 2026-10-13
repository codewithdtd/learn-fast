from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.ai import router as ai_router
from app.api.auth import router as auth_router
from app.api.calendar import router as calendar_router
from app.api.dashboard import router as dashboard_router
from app.api.flashcards import router as flashcards_router
from app.api.health import router as health_router
from app.api.notifications import router as notifications_router
from app.api.quick_recall import router as quick_recall_router
from app.api.sheets import router as sheets_router
from app.api.study_sessions import router as study_sessions_router
from app.api.workbooks import router as workbooks_router
from app.api.writing import router as writing_router
from app.core.config import settings
from app.core.demo_guard import DemoReadOnlyMiddleware


api_app = FastAPI(title="English SRS & Mastery Learning API")

# Demo Read-Only Guard
api_app.add_middleware(DemoReadOnlyMiddleware)


api_app.include_router(health_router, prefix="/api/v1")
api_app.include_router(auth_router, prefix="/api/v1")
api_app.include_router(dashboard_router, prefix="/api/v1")
api_app.include_router(calendar_router, prefix="/api/v1")
api_app.include_router(notifications_router, prefix="/api/v1")
api_app.include_router(workbooks_router, prefix="/api/v1")
api_app.include_router(sheets_router, prefix="/api/v1")
api_app.include_router(flashcards_router, prefix="/api/v1")
api_app.include_router(quick_recall_router, prefix="/api/v1")
api_app.include_router(study_sessions_router, prefix="/api/v1")
api_app.include_router(ai_router, prefix="/api/v1")
api_app.include_router(writing_router, prefix="/api/v1")

# Keep CORS outside FastAPI's exception middleware so the browser can read
# server-error responses and reveal the API failure instead of masking it as CORS.
app = CORSMiddleware(
    app=api_app,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)
