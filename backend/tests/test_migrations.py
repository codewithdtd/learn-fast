from sqlalchemy import inspect


def test_initial_migration_creates_core_tables(migrated_engine) -> None:
    table_names = set(inspect(migrated_engine).get_table_names())

    assert {"alembic_version", "flashcards", "study_sheets", "workbooks"} <= table_names
