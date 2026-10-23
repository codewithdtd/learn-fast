import hashlib
import hmac
import re

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.repositories.guest_ai_usage import GuestAIUsageRepository

def guest_key_hash_from_request(request: Request) -> str:
    """Hash a browser guest key before using it to associate anonymous practice rows."""
    guest_key = request.headers.get("X-Guest-Token", "")
    if not re.fullmatch(r"[A-Za-z0-9_-]{32,128}", guest_key):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A guest trial token is required.")
    return hmac.new(settings.secret_key.encode(), guest_key.encode(), hashlib.sha256).hexdigest()


def consume_guest_ai_trial(db: Session, request: Request, feature: str) -> None:
    """Limit anonymous AI calls without associating them with an account or storing content."""
    guest_key_hash = guest_key_hash_from_request(request)
    if not GuestAIUsageRepository(db).claim_once(guest_key_hash, feature):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Guest AI trial used. Sign in with an account that has AI access to continue.",
        )
