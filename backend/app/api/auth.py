from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, PasswordChangeRequest, TokenResponse
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.auth import (
    AuthService,
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    UserInactiveError,
    UsernameAlreadyExistsError,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(
    user_in: UserCreate,
    db: Annotated[Session, Depends(get_db)],
) -> UserRead:
    """
    Register a new user account.
    
    Python & FastAPI Concepts:
    - Automatically parses JSON request body into `UserCreate` Pydantic model.
    - Maps domain exceptions (`EmailAlreadyExistsError`) to HTTP 400 Bad Request.
    """
    auth_service = AuthService(db)
    try:
        new_user = auth_service.register_user(user_in)
        return UserRead.model_validate(new_user)
    except (EmailAlreadyExistsError, UsernameAlreadyExistsError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message,
        )


@router.post("/login", response_model=TokenResponse)
def login(
    login_data: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    """
    Authenticate user credentials and return an access token.
    """
    auth_service = AuthService(db)
    try:
        return auth_service.authenticate(login_data)
    except InvalidCredentialsError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
            headers={"WWW-Authenticate": "Bearer"},
        )
    except UserInactiveError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message,
        )


@router.get("/me", response_model=UserRead)
def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserRead:
    """
    Retrieve details of the currently authenticated user.
    """
    return UserRead.model_validate(current_user)


@router.put("/me", response_model=UserRead)
def update_profile(
    user_update: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserRead:
    """
    Update profile metadata for the authenticated user.
    """
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name

    if user_update.email is not None and user_update.email.strip().lower() != current_user.email:
        # Check uniqueness if user wants to change their email
        from app.repositories.user import UserRepository
        existing = UserRepository(db).get_by_email(user_update.email)
        if existing and existing.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already used by another account.",
            )
        current_user.email = user_update.email.strip().lower()

    db.commit()
    db.refresh(current_user)
    return UserRead.model_validate(current_user)


@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    pwd_data: PasswordChangeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    """
    Change password for the currently logged in user.
    """
    if not verify_password(pwd_data.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    current_user.hashed_password = get_password_hash(pwd_data.new_password)
    db.commit()
    return {"message": "Password updated successfully."}
