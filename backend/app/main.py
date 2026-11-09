from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.ai import router as ai_router
from app.api.auth import router as auth_router
from app.api.calendar import router as calendar_router
from app.api.dashboard import router as dashboard_router
from app.api.flashcards import router as flashcards_router
from app.api.health import router as health_router
from app.api.maintenance import router as maintenance_router
from app.api.ielts import router as ielts_router
from app.api.guest_ai import router as guest_ai_router
from app.api.notifications import router as notifications_router
from app.api.quick_recall import router as quick_recall_router
from app.api.reading import router as reading_router
from app.api.sheets import router as sheets_router
from app.api.speaking import router as speaking_router
from app.api.study_sessions import router as study_sessions_router
from app.api.workbooks import router as workbooks_router
from app.api.writing import router as writing_router
from app.api.video_practice import router as video_practice_router
from app.core.config import settings
from app.api.deps import get_current_admin


api_app = FastAPI(title="English SRS & Mastery Learning API")

# Root health check endpoint for cloud hosting providers (Render.com, UptimeRobot, Railway)
# Render defaults to probing '/' or '/health' to evaluate whether the instance is live.
# Providing 200 OK directly at root prevents 404 Health Check failures and restart loops.
@api_app.get("/", tags=["health"])
@api_app.get("/health", tags=["health"])
def root_health() -> dict[str, str]:
    return {"status": "ok", "service": "learn-fast-api"}

api_app.include_router(health_router, prefix="/api/v1")
api_app.include_router(auth_router, prefix="/api/v1")
# Learning content is public through the single read-only preview workbook; guest study sessions keep user_id NULL.
for public_learning_router in (
    workbooks_router, sheets_router, flashcards_router,
    ai_router, writing_router, speaking_router, dashboard_router, calendar_router,
    video_practice_router, reading_router,
    ielts_router,
):
    api_app.include_router(public_learning_router, prefix="/api/v1")
api_app.include_router(guest_ai_router, prefix="/api/v1")

# Quick Recall updates shared weak flags. Study sessions enforce user ownership in their own routes.
for persistent_learning_router in (quick_recall_router,):
    api_app.include_router(persistent_learning_router, prefix="/api/v1", dependencies=[Depends(get_current_admin)])

# Non-admins receive an empty notification list; only administrators may mutate the shared account notifications.
api_app.include_router(notifications_router, prefix="/api/v1")
api_app.include_router(maintenance_router, prefix="/api/v1")
api_app.include_router(study_sessions_router, prefix="/api/v1")

# Keep CORS outside FastAPI's exception middleware so the browser can read
# server-error responses and reveal the API failure instead of masking it as CORS.
app = CORSMiddleware(
    app=api_app,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "X-Guest-Token"],
)


if __name__ == "__main__":
    import os
    import uvicorn

    # Automatically bind to 0.0.0.0 and the dynamically injected PORT on cloud environments (Render)
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, workers=1)

