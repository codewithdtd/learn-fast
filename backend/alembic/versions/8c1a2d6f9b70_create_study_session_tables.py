"""create study session tables

Revision ID: 8c1a2d6f9b70
Revises: 4be403c69ae5
Create Date: 2026-07-31 20:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8c1a2d6f9b70"
down_revision: Union[str, Sequence[str], None] = "4be403c69ae5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "study_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sheet_id", sa.Integer(), nullable=False),
        sa.Column(
            "session_type",
            sa.Enum(
                "new_learning",
                "srs_review",
                "weak_cards",
                "quick_recall",
                name="study_session_type",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "direction",
            sa.Enum(
                "en_to_vi",
                "vi_to_en",
                "mixed",
                name="study_direction",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "active",
                "completed",
                "abandoned",
                name="study_session_status",
                native_enum=False,
                create_constraint=True,
            ),
            server_default="active",
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_cards", sa.Integer(), nullable=False),
        sa.Column("total_attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("first_try_correct", sa.Integer(), server_default="0", nullable=False),
        sa.Column("again_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("mastery_score", sa.Float(), nullable=True),
        sa.Column("sheet_rating", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["sheet_id"], ["study_sheets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("study_sessions", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_study_sessions_sheet_id"), ["sheet_id"], unique=False)

    op.create_table(
        "study_session_cards",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("flashcard_id", sa.Integer(), nullable=False),
        sa.Column(
            "direction",
            sa.Enum(
                "en_to_vi",
                "vi_to_en",
                "mixed",
                name="study_direction",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=True,
        ),
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("again_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("remembered", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("first_try_correct", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("last_answered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["flashcard_id"], ["flashcards.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_id"], ["study_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "flashcard_id", name="uq_session_cards_session_flashcard"),
    )
    with op.batch_alter_table("study_session_cards", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_study_session_cards_flashcard_id"), ["flashcard_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_study_session_cards_session_id"), ["session_id"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("study_session_cards", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_study_session_cards_session_id"))
        batch_op.drop_index(batch_op.f("ix_study_session_cards_flashcard_id"))
    op.drop_table("study_session_cards")

    with op.batch_alter_table("study_sessions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_study_sessions_sheet_id"))
    op.drop_table("study_sessions")
