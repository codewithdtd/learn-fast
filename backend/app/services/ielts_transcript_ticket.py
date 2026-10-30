import base64
import hashlib
import hmac
import json
import time
import zlib

from fastapi import HTTPException, Request

from app.core.config import settings
from app.models.user import User
from app.schemas.video_practice import TranscriptResponse
from app.services.guest_ai_quota import guest_key_hash_from_request


TICKET_TTL_SECONDS = 15 * 60
MAX_TICKET_LENGTH = 100_000
MAX_DECOMPRESSED_BYTES = 512_000


class TranscriptTicketError(ValueError):
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.status_code = status_code


def transcript_owner_key(request: Request, user: User | None) -> str | None:
    """Gắn quyền dùng lại transcript với người gọi để ticket không vượt qua tài khoản khác."""
    if user is not None:
        return f"account:{user.id}"
    if not request.headers.get("X-Guest-Token"):
        return None
    try:
        return f"guest:{guest_key_hash_from_request(request)}"
    except HTTPException:
        return None


def issue_transcript_ticket(transcript: TranscriptResponse, owner_key: str | None) -> str | None:
    """Ký transcript đã tải để chuyển sang IELTS trong thời gian ngắn và đúng chủ sở hữu."""
    if owner_key is None:
        return None
    now = int(time.time())
    body = json.dumps({
        "version": 1,
        "owner": owner_key,
        "issued_at": now,
        "expires_at": now + TICKET_TTL_SECONDS,
        "transcript": transcript.model_dump(exclude={"ielts_source_ticket"}),
    }, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(body) > MAX_DECOMPRESSED_BYTES:
        return None
    encoded = base64.urlsafe_b64encode(zlib.compress(body, level=6)).rstrip(b"=").decode("ascii")
    signature = _sign(encoded)
    ticket = f"{encoded}.{signature}"
    return ticket if len(ticket) <= MAX_TICKET_LENGTH else None


def verify_transcript_ticket(ticket: str, owner_key: str | None, *, now: int | None = None) -> TranscriptResponse:
    """Kiểm tra chữ ký, hạn dùng, chủ sở hữu và cấu trúc transcript trước khi tái sử dụng."""
    if owner_key is None:
        raise TranscriptTicketError("Reload this video before using it for IELTS practice.", 403)
    if not ticket or len(ticket) > MAX_TICKET_LENGTH or ticket.count(".") != 1:
        raise TranscriptTicketError("The video transcript ticket is invalid. Load the video again.")
    encoded, signature = ticket.split(".", 1)
    if not hmac.compare_digest(signature, _sign(encoded)):
        raise TranscriptTicketError("The video transcript ticket is invalid. Load the video again.")
    try:
        compressed = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
        decompressor = zlib.decompressobj()
        raw = decompressor.decompress(compressed, MAX_DECOMPRESSED_BYTES + 1)
        if len(raw) > MAX_DECOMPRESSED_BYTES or not decompressor.eof or decompressor.unconsumed_tail or decompressor.unused_data:
            raise ValueError("Ticket payload exceeds bounds.")
        payload = json.loads(raw)
    except (ValueError, zlib.error, json.JSONDecodeError) as error:
        raise TranscriptTicketError("The video transcript ticket is invalid. Load the video again.") from error
    if not isinstance(payload, dict) or payload.get("version") != 1:
        raise TranscriptTicketError("The video transcript ticket is invalid. Load the video again.")
    if not hmac.compare_digest(str(payload.get("owner", "")), owner_key):
        raise TranscriptTicketError("This transcript belongs to a different session. Load the video again.", 403)
    current_time = int(time.time()) if now is None else now
    expires_at = payload.get("expires_at")
    issued_at = payload.get("issued_at")
    if not isinstance(expires_at, int) or not isinstance(issued_at, int) or issued_at > current_time + 30:
        raise TranscriptTicketError("The video transcript ticket is invalid. Load the video again.")
    if expires_at <= current_time or expires_at - issued_at > TICKET_TTL_SECONDS:
        raise TranscriptTicketError("This transcript ticket has expired. Reload the video to continue.", 410)
    try:
        return TranscriptResponse.model_validate(payload["transcript"])
    except (KeyError, ValueError) as error:
        raise TranscriptTicketError("The video transcript ticket is invalid. Load the video again.") from error


def _sign(value: str) -> str:
    digest = hmac.new(settings.secret_key.encode("utf-8"), value.encode("ascii"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
