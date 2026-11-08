from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


# Ensure parent directory exists for SQLite database before connection attempt
if settings.database_url.startswith("sqlite"):
    raw_path = settings.database_url.replace("sqlite:///", "")
    if raw_path and not raw_path.startswith(":memory:"):
        Path(raw_path).resolve().parent.mkdir(parents=True, exist_ok=True)

connect_args: dict[str, object] = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {"connect_timeout": 15}
)

# Business logic: SQLite connections are thread-bound by default, while FastAPI may execute
# synchronous dependencies in a worker thread different from the request setup.
# For Cloud Serverless PostgreSQL (Neon DB, Supabase, Render), compute autosuspends after 5 min.
# - pool_pre_ping=True sends an automatic test probe before each transaction, silently discarding
#   dead sockets left behind after Neon sleep and eliminating 500 OperationalErrors.
# - pool_recycle=300 actively recycles sockets before the 5-minute idle cutoff.
# - connect_timeout=15 allows sufficient grace period for Neon compute to wake up without timing out.
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
