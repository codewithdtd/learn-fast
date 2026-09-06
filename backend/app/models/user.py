from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, utc_now

if TYPE_CHECKING:
    from app.models.notification import Notification
    from app.models.study_session import StudySession
    from app.models.workbook import Workbook


class User(TimestampMixin, Base):
    """
    SQLAlchemy 2.0 ORM Model for Application Users.
    
    Python & SQLAlchemy 2.0 Concepts:
    - `Mapped[T]`: Modern Python Type Annotation indicating that an attribute is mapped to a DB column with type T.
    - `mapped_column(...)`: Configures database-specific column attributes like constraints, indexes, nullability.
    - `relationship(...)`: Establishes bidirectional associations between ORM entities.
    - `TimestampMixin`: Python multiple inheritance pattern providing `created_at` and `updated_at`.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Multi-tenant data relationships owned by this user
    workbooks: Mapped[list["Workbook"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    study_sessions: Mapped[list["StudySession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
