"""create notifications table

Revision ID: e4a71b829c30
Revises: f3b0c4d29a71
Create Date: 2026-08-30 14:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4a71b829c30"
down_revision: Union[str, Sequence[str], None] = "f3b0c4d29a71"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("notification_type", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("link_url", sa.String(length=500), nullable=True),
        sa.Column("is_read", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("notifications", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_notifications_notification_type"), ["notification_type"], unique=False)
        batch_op.create_index(batch_op.f("ix_notifications_scheduled_for"), ["scheduled_for"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("notifications", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_notifications_scheduled_for"))
        batch_op.drop_index(batch_op.f("ix_notifications_notification_type"))
    op.drop_table("notifications")
