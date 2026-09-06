from fastapi import APIRouter
from app.core.config import settings


router = APIRouter(tags=["health"])


@router.get("/health")
def get_health() -> dict[str, str | bool]:
    """Return system health status and environment flags like demo_mode."""
    return {
        "status": "ok",
        "demo_mode": settings.demo_mode,
    }

