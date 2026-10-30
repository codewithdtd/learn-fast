import hashlib
import hmac
import logging
import re
from contextlib import contextmanager
from collections.abc import Iterator

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.repositories.guest_ai_usage import GuestAIUsageRepository
from app.models.user import User

logger = logging.getLogger(__name__)


def _account_identity(user: User) -> str:
    return hmac.new(settings.secret_key.encode(), f"account:{user.id}".encode(), hashlib.sha256).hexdigest()


def account_trial_used(db: Session, user: User, feature: str, request: Request | None = None) -> bool:
    repository = GuestAIUsageRepository(db)
    if repository.has_claim(_account_identity(user), feature):
        return True
    return bool(request and request.headers.get("X-Guest-Token") and repository.has_claim(guest_key_hash_from_request(request), feature))


def guest_key_hash_from_request(request: Request) -> str:
    """Hash a browser guest key before using it to associate anonymous practice rows."""
    guest_key = request.headers.get("X-Guest-Token", "")
    if not re.fullmatch(r"[A-Za-z0-9_-]{32,128}", guest_key):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A guest trial token is required.")
    return hmac.new(settings.secret_key.encode(), guest_key.encode(), hashlib.sha256).hexdigest()


@contextmanager
def provider_trial(
    db: Session, request: Request, feature: str, user: User | None
) -> Iterator[None]:
    """Giữ một lượt cho tài khoản hoặc guest; chỉ admin bỏ qua quota ứng dụng."""
    if user is not None and user.is_superuser:
        yield
        return

    if user is not None:
        identities = [_account_identity(user)]
        # Cùng browser không nhận thêm lượt khi đăng xuất sau khi đã dùng thử bằng tài khoản.
        if request.headers.get("X-Guest-Token"):
            identities.append(guest_key_hash_from_request(request))
    else:
        identities = []
        if request.headers.get("X-Guest-Token"):
            identities.append(guest_key_hash_from_request(request))
        # Chỉ dùng IP do server/proxy tin cậy cung cấp, không tin X-Forwarded-For từ client.
        client_host = request.client.host if request.client else "unknown"
        identities.append(hmac.new(settings.secret_key.encode(), f"guest-ip:{client_host}".encode(), hashlib.sha256).hexdigest())

    repository = GuestAIUsageRepository(db)
    if not repository.claim_many_once(identities, feature):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="This feature's one-time trial has already been used. Only an administrator can continue using it.",
        )
    released = False

    def refund() -> None:
        nonlocal released
        if released:
            return
        try:
            db.rollback()
            repository.release(identities, feature)
            released = True
        except Exception:
            db.rollback()
            logger.exception("Could not release failed provider trial feature=%s", feature)

    try:
        # Giữ chỗ trước khi gọi provider để request đồng thời không vượt quota.
        yield
    except Exception as error:
        # Chỉ hoàn lượt nếu đầu vào sai hoặc provider báo hết quota/không sẵn sàng;
        # feedback AI sai sau khi gọi vẫn tính lượt để không cho gọi lại vô hạn.
        error_status = getattr(error, "status_code", None)
        if type(error) is ValueError or error_status in {400, 404, 409, 413, 415, 422, 429, 503, 504}:
            refund()
        raise
