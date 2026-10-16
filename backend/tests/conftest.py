import os
import shutil
import subprocess
import sys
from collections.abc import Generator
from hashlib import sha256
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.database import get_db
from app.main import api_app, app

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def workspace_test_root() -> Generator[Path, None, None]:
    # Keep test databases inside the repository because this project runs in workspace-restricted Windows environments.
    root = BACKEND_DIR.parent / ".tmp" / f"pytest-{uuid4().hex}"
    root.mkdir(parents=True)
    try:
        yield root
    finally:
        shutil.rmtree(root)


@pytest.fixture()
def tmp_path(request: pytest.FixtureRequest, workspace_test_root: Path) -> Path:
    # Hash the node id so parametrized tests receive isolated, filesystem-safe SQLite paths.
    suffix = sha256(request.node.nodeid.encode("utf-8")).hexdigest()[:16]
    path = workspace_test_root / f"{request.node.name[:48]}-{suffix}"
    path.mkdir()
    return path


@pytest.fixture()
def database_url(tmp_path: Path) -> str:
    return f"sqlite:///{(tmp_path / 'test.db').as_posix()}"


@pytest.fixture()
def migrated_engine(database_url: str):
    environment = os.environ | {"DATABASE_URL": database_url}
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )

    engine = create_engine(database_url, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, _connection_record) -> None:
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture()
def db_session(migrated_engine) -> Generator[Session, None, None]:
    session = sessionmaker(bind=migrated_engine)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def api_client(db_session: Session) -> Generator[TestClient, None, None]:
    """Give every API test an isolated database-backed FastAPI client."""

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    api_app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client
    api_app.dependency_overrides.clear()


@pytest.fixture()
def admin_headers(db_session: Session) -> dict[str, str]:
    """Provides authorization headers for an active admin (is_superuser=True) user."""
    from app.core.security import create_access_token, get_password_hash
    from app.models.user import User

    admin = User(
        email="admin_fixture@example.com",
        username="admin_fixture",
        hashed_password=get_password_hash("AdminPass123"),
        is_active=True,
        is_superuser=True,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)

    token = create_access_token(subject=admin.id)
    return {"Authorization": f"Bearer {token}"}

