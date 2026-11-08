from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {}
)

# Business logic: SQLite connections are thread-bound by default, while FastAPI may execute
# synchronous dependencies in a worker thread different from the request setup.
# For Cloud PostgreSQL (Render / Neon / Supabase), pool_pre_ping=True and pool_recycle=300
# automatically refresh stale/dead sockets after container sleep, eliminating 500 connection errors.
engine_kwargs: dict[str, object] = {
    "connect_args": connect_args,
}

if not settings.database_url.startswith("sqlite"):
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300

engine = create_engine(settings.database_url, **engine_kwargs)

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
