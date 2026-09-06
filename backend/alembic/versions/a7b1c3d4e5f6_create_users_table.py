"""create users table and user foreign keys

Revision ID: a7b1c3d4e5f6
Revises: e4a71b829c30
Create Date: 2026-09-07 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7b1c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "e4a71b829c30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="1", nullable=False),
        sa.Column("is_superuser", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_users_email"), ["email"], unique=True)
        batch_op.create_index(batch_op.f("ix_users_username"), ["username"], unique=True)

    # 2. Add user_id to workbooks
    with op.batch_alter_table("workbooks", schema=None) as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f("ix_workbooks_user_id"), ["user_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_workbooks_user_id_users",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )

    # 3. Add user_id to study_sessions
    with op.batch_alter_table("study_sessions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f("ix_study_sessions_user_id"), ["user_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_study_sessions_user_id_users",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )

    # 4. Add user_id to notifications
    with op.batch_alter_table("notifications", schema=None) as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f("ix_notifications_user_id"), ["user_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_notifications_user_id_users",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    with op.batch_alter_table("notifications", schema=None) as batch_op:
        batch_op.drop_constraint("fk_notifications_user_id_users", type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_notifications_user_id"))
        batch_op.drop_column("user_id")

    with op.batch_alter_table("study_sessions", schema=None) as batch_op:
        batch_op.drop_constraint("fk_study_sessions_user_id_users", type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_study_sessions_user_id"))
        batch_op.drop_column("user_id")

    with op.batch_alter_table("workbooks", schema=None) as batch_op:
        batch_op.drop_constraint("fk_workbooks_user_id_users", type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_workbooks_user_id"))
        batch_op.drop_column("user_id")

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_users_username"))
        batch_op.drop_index(batch_op.f("ix_users_email"))
    op.drop_table("users")
