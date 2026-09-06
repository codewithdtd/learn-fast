from typing import Optional
from pydantic import BaseModel, Field

from app.schemas.user import UserRead


class LoginRequest(BaseModel):
    """Payload for user credentials upon login (supports either username or email)."""
    username_or_email: str = Field(..., min_length=3, description="Username or Email address")
    password: str = Field(..., min_length=1, description="Account password")


class TokenResponse(BaseModel):
    """
    Standard OAuth2 / JWT Token response schema.
    """
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    user: UserRead


class TokenPayload(BaseModel):
    """Internal decoded JWT payload representation."""
    sub: str  # User ID as string
    exp: int
    iat: int


class PasswordChangeRequest(BaseModel):
    """Payload for authenticated users changing their password."""
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=128)
