from typing import Annotated, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.repositories.user import UserRepository

# HTTPBearer extracts the Bearer token from the `Authorization: Bearer <token>` header.
# auto_error=False allows optional authentication for endpoints that support anonymous guest access.
http_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user_optional(
    auth_header: Annotated[Optional[HTTPAuthorizationCredentials], Depends(http_bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> Optional[User]:
    """
    Optional Authentication Dependency.
    
    Returns:
    - User instance if a valid JWT bearer token is present in headers.
    - None if request is unauthenticated (allows guest fallback).
    """
    if not auth_header or not auth_header.credentials:
        return None

    token = auth_header.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None

    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        return None

    user = UserRepository(db).get_by_id(user_id)
    if not user or not user.is_active:
        return None

    return user


def get_current_user(
    auth_header: Annotated[Optional[HTTPAuthorizationCredentials], Depends(http_bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """
    Mandatory Authentication Dependency.
    
    FastAPI & Python Concepts:
    - `Annotated[T, Depends(...)]`: Modern FastAPI pattern combining static typing with dependency injection.
    - Raises HTTP 401 Unauthorized with standard `WWW-Authenticate: Bearer` header if authentication fails.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not auth_header or not auth_header.credentials:
        raise credentials_exception

    token = auth_header.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise credentials_exception

    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        raise credentials_exception

    user = UserRepository(db).get_by_id(user_id)
    if not user:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account.",
        )

    return user
