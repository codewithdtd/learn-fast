from datetime import datetime, timedelta, timezone
from typing import Any
import bcrypt
import jwt

from app.core.config import settings


def get_password_hash(password: str) -> str:
    """
    Hash a plain text password using bcrypt directly.
    
    Why this is used in Python / Security:
    - Never store raw passwords in database tables.
    - Bcrypt adds a random cryptographic salt and performs key stretching,
      making brute-force attacks computationally expensive.
    - We truncate to 72 bytes internally according to the bcrypt specification.
    """
    password_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Check whether a candidate plain password matches an existing bcrypt hash.
    
    Why this is used:
    - Bcrypt hashes cannot be decrypted.
    - Verification extracts the salt from the stored hash and hashes the candidate
      password to compare in constant time, preventing timing attacks.
    """
    password_bytes = plain_password.encode("utf-8")[:72]
    hashed_bytes = hashed_password.encode("utf-8")
    try:
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


def create_access_token(
    subject: str | int,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """
    Generate an RFC 7519 compliant JSON Web Token (JWT).
    
    Python & Auth Concepts:
    - `subject` (`sub` claim): Uniquely identifies the principal (user ID or username).
    - `exp` claim: Expiration timestamp in UTC Unix epoch.
    - `iat` claim: Issued At timestamp in UTC Unix epoch.
    - `jwt.encode`: Signs the header + payload using the HMAC-SHA256 algorithm and our SECRET_KEY.
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode: dict[str, Any] = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    if extra_claims:
        to_encode.update(extra_claims)

    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def decode_access_token(token: str) -> dict[str, Any] | None:
    """
    Decode and verify a JWT token signature and expiration.
    
    Python & Auth Concepts:
    - Returns decoded payload dictionary if signature and timestamps are valid.
    - Catches `jwt.PyJWTError` (ExpiredSignatureError, InvalidTokenError) safely.
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except jwt.PyJWTError:
        return None
