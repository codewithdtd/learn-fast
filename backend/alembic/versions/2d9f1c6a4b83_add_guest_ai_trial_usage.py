"""add anonymous guest AI trial usage

Revision ID: 2d9f1c6a4b83
Revises: be27a591d8e0
Create Date: 2026-10-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2d9f1c6a4b83"
down_revision: Union[str, Sequence[str], None] = "be27a591d8e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("study_sessions", sa.Column("guest_key_hash", sa.String(length=64), nullable=True))
    op.create_index("ix_study_sessions_guest_key_hash", "study_sessions", ["guest_key_hash"], unique=False)
    op.create_table(
        "guest_ai_usage",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("guest_key_hash", sa.String(length=64), nullable=False),
        sa.Column("feature", sa.String(length=48), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("guest_key_hash", "feature", name="uq_guest_ai_feature"),
    )
    op.create_index("ix_guest_ai_usage_guest_key_hash", "guest_ai_usage", ["guest_key_hash"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_guest_ai_usage_guest_key_hash", table_name="guest_ai_usage")
    op.drop_table("guest_ai_usage")
    op.drop_index("ix_study_sessions_guest_key_hash", table_name="study_sessions")
    op.drop_column("study_sessions", "guest_key_hash")
