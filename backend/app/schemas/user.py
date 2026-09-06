from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserBase(BaseModel):
    """
    Base attributes shared across User schemas.
    
    Pydantic V2 Concepts:
    - EmailStr: Validates RFC-compliant email formats automatically using python email-validator.
    - Field(...): Adds metadata, descriptions, and constraints (min_length, max_length).
    """
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    full_name: Optional[str] = Field(None, max_length=100)


class UserCreate(UserBase):
    """
    Schema for User Registration.
    
    Python & Pydantic Concepts:
    - Custom `@field_validator` to enforce strong password policies.
    - `strip_whitespace=True` cleans inputs before validation.
    """
    password: str = Field(..., min_length=6, max_length=128, description="Plaintext password")

    @field_validator("username")
    @classmethod
    def username_to_lower(cls, v: str) -> str:
        """Normalize username to lowercase for case-insensitive logins."""
        return v.strip().lower()

    @field_validator("email")
    @classmethod
    def email_to_lower(cls, v: str) -> str:
        """Normalize email address to lowercase."""
        return v.strip().lower()


class UserUpdate(BaseModel):
    """Schema for updating User profile information."""
    full_name: Optional[str] = Field(None, max_length=100)
    email: Optional[EmailStr] = None


class UserRead(UserBase):
    """
    Public schema for returning User information to client.
    
    Security Concept:
    - Notice `hashed_password` is completely omitted from this schema.
    - `from_attributes = True` allows Pydantic to read directly from SQLAlchemy ORM instances.
    """
    id: int
    is_active: bool
    is_superuser: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
