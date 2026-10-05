from fastapi import APIRouter, Response


router = APIRouter(tags=["health"])


@router.get("/health")
def get_health() -> Response:
    """Return a tiny success body for uptime monitors."""
    return Response(content="ok", media_type="text/plain")

