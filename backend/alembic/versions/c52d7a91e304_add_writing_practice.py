"""add writing practice and feedback history

Revision ID: c52d7a91e304
Revises: 884cc5f57564
Create Date: 2026-10-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c52d7a91e304"
down_revision: Union[str, Sequence[str], None] = "884cc5f57564"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "writing_prompts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("title_vi", sa.String(length=160), nullable=False),
        sa.Column("title_en", sa.String(length=160), nullable=False),
        sa.Column("prompt_vi", sa.Text(), nullable=False),
        sa.Column("prompt_en", sa.Text(), nullable=False),
        sa.Column("difficulty", sa.String(length=24), server_default="basic", nullable=False),
        sa.Column("format", sa.String(length=32), server_default="paragraph", nullable=False),
        sa.Column("target_word_count", sa.Integer(), server_default="90", nullable=False),
        sa.Column("sentence_hints", sa.JSON(), nullable=False),
        sa.Column("paragraph_hints", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("content_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_writing_prompts_slug"),
    )

    op.create_table(
        "writing_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("prompt_id", sa.Integer(), nullable=False),
        sa.Column("prompt_snapshot", sa.JSON(), nullable=False),
        sa.Column("revision_of_id", sa.Integer(), nullable=True),
        sa.Column("draft_text", sa.Text(), server_default="", nullable=False),
        sa.Column("submitted_text", sa.Text(), nullable=True),
        sa.Column("word_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("status", sa.String(length=16), server_default="draft", nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("grading_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("grading_token", sa.String(length=36), nullable=True),
        sa.Column("graded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("feedback_json", sa.JSON(), nullable=True),
        sa.Column("practice_score", sa.Float(), nullable=True),
        sa.Column("model_name", sa.String(length=120), nullable=True),
        sa.Column("rubric_version", sa.String(length=40), nullable=True),
        sa.Column("error_code", sa.String(length=40), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["prompt_id"], ["writing_prompts.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["revision_of_id"], ["writing_attempts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_writing_attempts_user_id", "writing_attempts", ["user_id"])
    op.create_index("ix_writing_attempts_prompt_id", "writing_attempts", ["prompt_id"])
    op.create_index("ix_writing_attempts_status", "writing_attempts", ["status"])
    op.create_index("ix_writing_attempts_user_created", "writing_attempts", ["user_id", "created_at"])
    op.create_index("ix_writing_attempts_user_status", "writing_attempts", ["user_id", "status"])
    op.create_table(
        "writing_ai_usage",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("used_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "usage_date", name="uq_writing_ai_usage_user_date"),
    )
    op.create_index("ix_writing_ai_usage_user_id", "writing_ai_usage", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_writing_ai_usage_user_id", table_name="writing_ai_usage")
    op.drop_table("writing_ai_usage")
    op.drop_index("ix_writing_attempts_user_status", table_name="writing_attempts")
    op.drop_index("ix_writing_attempts_user_created", table_name="writing_attempts")
    op.drop_index("ix_writing_attempts_status", table_name="writing_attempts")
    op.drop_index("ix_writing_attempts_prompt_id", table_name="writing_attempts")
    op.drop_index("ix_writing_attempts_user_id", table_name="writing_attempts")
    op.drop_table("writing_attempts")
    op.drop_table("writing_prompts")
