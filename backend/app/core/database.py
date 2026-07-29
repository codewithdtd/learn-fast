from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {}
)

# SQLite connections are thread-bound by default, while FastAPI may execute
# synchronous dependencies in a worker thread different from the request setup.
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Base class shared by every SQLAlchemy ORM model."""


def get_db() -> Generator[Session, None, None]:
    """Provide one database session per request and close it reliably."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
