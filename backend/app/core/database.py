from collections.abc import Generator

from sqlalchemy import create_engine, event
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

if settings.database_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
        # SQLite leaves foreign-key enforcement disabled by default, which would
        # otherwise make workbook deletion behave differently from PostgreSQL.
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

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
