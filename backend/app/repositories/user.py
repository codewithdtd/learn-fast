from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate


class UserRepository:
    """
    Data Access Layer (Repository Pattern) for the User entity.
    
    Python & Architecture Concepts:
    - Isolates raw SQLAlchemy queries from business logic.
    - Promotes testability by allowing mock repositories in unit tests.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, user_id: int) -> Optional[User]:
        """Fetch a user by primary key."""
        return self.db.get(User, user_id)

    def get_by_email(self, email: str) -> Optional[User]:
        """Fetch a user by email address (case-insensitive)."""
        return self.db.scalar(
            select(User).where(User.email == email.strip().lower())
        )

    def get_by_username(self, username: str) -> Optional[User]:
        """Fetch a user by username (case-insensitive)."""
        return self.db.scalar(
            select(User).where(User.username == username.strip().lower())
        )

    def get_by_username_or_email(self, identifier: str) -> Optional[User]:
        """
        Fetch a user matching either username or email.
        
        Python / SQLAlchemy Concept:
        - `or_()` builds a SQL `WHERE (col1 = val OR col2 = val)` clause safely.
        """
        clean_id = identifier.strip().lower()
        return self.db.scalar(
            select(User).where(
                or_(
                    User.username == clean_id,
                    User.email == clean_id,
                )
            )
        )

    def create(self, user_in: UserCreate, hashed_password: str) -> User:
        """Instantiate and persist a new User entity."""
        user = User(
            email=user_in.email.strip().lower(),
            username=user_in.username.strip().lower(),
            hashed_password=hashed_password,
            full_name=user_in.full_name,
            is_active=True,
            is_superuser=False,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_last_login(self, user: User) -> None:
        """Record the timestamp when the user successfully authenticates."""
        user.last_login_at = datetime.now(timezone.utc)
        self.db.commit()
