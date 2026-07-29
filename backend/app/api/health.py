from fastapi import APIRouter


router = APIRouter(tags=["health"])


@router.get("/health")
def get_health() -> dict[str, str]:
    """Return a minimal availability signal for local integration checks."""
    return {"status": "ok"}
