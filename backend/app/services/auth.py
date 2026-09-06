from datetime import timedelta
from typing import Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserCreate, UserRead


class AuthenticationError(Exception):
    """Base exception for authentication business failures."""
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class EmailAlreadyExistsError(AuthenticationError):
    pass


class UsernameAlreadyExistsError(AuthenticationError):
    pass


class InvalidCredentialsError(AuthenticationError):
    pass


class UserInactiveError(AuthenticationError):
    pass


class AuthService:
    """
    Business Logic Layer for User Registration and Authentication.
    
    Python Concepts:
    - Custom domain exceptions for clean separation of concerns from HTTP status codes.
    - Encapsulates password hashing and token generation workflows.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.user_repo = UserRepository(db)

    def register_user(self, user_in: UserCreate) -> User:
        """
        Validate uniqueness and persist a newly registered user.
        """
        if self.user_repo.get_by_email(user_in.email):
            raise EmailAlreadyExistsError("An account with this email already exists.")

        if self.user_repo.get_by_username(user_in.username):
            raise UsernameAlreadyExistsError("This username is already taken.")

        hashed_pwd = get_password_hash(user_in.password)
        new_user = self.user_repo.create(user_in=user_in, hashed_password=hashed_pwd)
        return new_user

    def authenticate(self, login_data: LoginRequest) -> TokenResponse:
        """
        Authenticate credentials and generate an Access Token (JWT).
        """
        user = self.user_repo.get_by_username_or_email(login_data.username_or_email)
        if not user or not verify_password(login_data.password, user.hashed_password):
            raise InvalidCredentialsError("Invalid username/email or password.")

        if not user.is_active:
            raise UserInactiveError("User account is inactive. Please contact support.")

        self.user_repo.update_last_login(user)

        # Generate JWT token
        token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        token = create_access_token(
            subject=user.id,
            expires_delta=token_expires,
            extra_claims={"username": user.username, "email": user.email},
        )

        return TokenResponse(
            access_token=token,
            token_type="bearer",
            expires_in_seconds=settings.access_token_expire_minutes * 60,
            user=UserRead.model_validate(user),
        )
