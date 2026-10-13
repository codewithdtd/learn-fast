"""add a separate daily quota for AI-generated writing topics

Revision ID: d4b8f2a71c06
Revises: c52d7a91e304
Create Date: 2026-10-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4b8f2a71c06"
down_revision: Union[str, Sequence[str], None] = "c52d7a91e304"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "writing_ai_usage",
        sa.Column("topic_generation_count", sa.Integer(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("writing_ai_usage", "topic_generation_count")
