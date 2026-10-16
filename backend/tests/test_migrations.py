import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import inspect


def test_initial_migration_creates_core_tables(migrated_engine) -> None:
    table_names = set(inspect(migrated_engine).get_table_names())

    assert {
        "alembic_version",
        "flashcards",
        "study_sheets",
        "study_session_cards",
        "study_sessions",
        "workbooks",
        "writing_prompts",
        "writing_attempts",
        "writing_ai_usage",
        "speaking_prompts",
        "speaking_attempts",
        "speaking_ai_usage",
    } <= table_names


def test_writing_migration_can_downgrade_and_upgrade(migrated_engine) -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    environment = os.environ | {"DATABASE_URL": str(migrated_engine.url)}
    subprocess.run(
        [sys.executable, "-m", "alembic", "downgrade", "884cc5f57564"],
        cwd=backend_dir,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )
    assert "writing_attempts" not in inspect(migrated_engine).get_table_names()
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=backend_dir,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )
    assert "writing_attempts" in inspect(migrated_engine).get_table_names()


def test_speaking_migration_seeds_topics_and_can_downgrade(migrated_engine) -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    environment = os.environ | {"DATABASE_URL": str(migrated_engine.url)}
    with migrated_engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT COUNT(*) FROM speaking_prompts").scalar_one() == 8
    subprocess.run(
        [sys.executable, "-m", "alembic", "downgrade", "d4b8f2a71c06"],
        cwd=backend_dir, env=environment, check=True, capture_output=True, text=True,
    )
    assert "speaking_prompts" not in inspect(migrated_engine).get_table_names()
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=backend_dir, env=environment, check=True, capture_output=True, text=True,
    )
    assert "speaking_prompts" in inspect(migrated_engine).get_table_names()
