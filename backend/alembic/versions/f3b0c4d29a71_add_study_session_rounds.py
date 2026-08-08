"""add persisted study session rounds

Revision ID: f3b0c4d29a71
Revises: 8c1a2d6f9b70
Create Date: 2026-08-09 10:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f3b0c4d29a71"
down_revision: Union[str, Sequence[str], None] = "8c1a2d6f9b70"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "study_session_rounds",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("source_round_id", sa.Integer(), nullable=True),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("scope", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="active", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_cards", sa.Integer(), nullable=False),
        sa.Column("remembered_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("again_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("recall_percentage", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["study_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_round_id"], ["study_session_rounds.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "round_number", name="uq_session_round_number"),
    )
    with op.batch_alter_table("study_session_rounds", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_study_session_rounds_session_id"), ["session_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_study_session_rounds_source_round_id"), ["source_round_id"], unique=False)

    op.create_table(
        "study_session_round_cards",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("round_id", sa.Integer(), nullable=False),
        sa.Column("session_card_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("result", sa.String(length=16), nullable=True),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["round_id"], ["study_session_rounds.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_card_id"], ["study_session_cards.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("round_id", "session_card_id", name="uq_round_cards_round_session_card"),
        sa.UniqueConstraint("round_id", "position", name="uq_round_cards_round_position"),
    )
    with op.batch_alter_table("study_session_round_cards", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_study_session_round_cards_round_id"), ["round_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_study_session_round_cards_session_card_id"), ["session_card_id"], unique=False)

    # Active sessions created before Day 18 have answer counters but no queue
    # snapshot. Preserve their visible state in a round-one queue so they can
    # continue safely after the migration; completed legacy sessions retain
    # their historical metrics and intentionally receive no synthetic rounds.
    bind = op.get_bind()
    metadata = sa.MetaData()
    sessions = sa.Table("study_sessions", metadata, autoload_with=bind)
    session_cards = sa.Table("study_session_cards", metadata, autoload_with=bind)
    rounds = sa.Table("study_session_rounds", metadata, autoload_with=bind)
    round_cards = sa.Table("study_session_round_cards", metadata, autoload_with=bind)
    active_sessions = bind.execute(
        sa.select(sessions).where(sessions.c.status == "active")
    ).mappings()
    for session in active_sessions:
        round_id = bind.execute(
            rounds.insert().values(
                session_id=session["id"],
                round_number=1,
                scope="all",
                status="active",
                started_at=session["started_at"],
                total_cards=session["total_cards"],
                remembered_count=0,
                again_count=0,
                created_at=session["created_at"],
                updated_at=session["updated_at"],
            )
        ).inserted_primary_key[0]
        legacy_cards = bind.execute(
            sa.select(session_cards)
            .where(session_cards.c.session_id == session["id"])
            .order_by(session_cards.c.id)
        ).mappings()
        for position, session_card in enumerate(legacy_cards, start=1):
            result = None
            if session_card["remembered"]:
                result = "remembered"
            elif session_card["attempt_count"] > 0 or session_card["again_count"] > 0:
                result = "again"
            bind.execute(
                round_cards.insert().values(
                    round_id=round_id,
                    session_card_id=session_card["id"],
                    position=position,
                    result=result,
                    answered_at=session_card["last_answered_at"],
                    created_at=session_card["created_at"],
                    updated_at=session_card["updated_at"],
                )
            )


def downgrade() -> None:
    with op.batch_alter_table("study_session_round_cards", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_study_session_round_cards_session_card_id"))
        batch_op.drop_index(batch_op.f("ix_study_session_round_cards_round_id"))
    op.drop_table("study_session_round_cards")
    with op.batch_alter_table("study_session_rounds", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_study_session_rounds_source_round_id"))
        batch_op.drop_index(batch_op.f("ix_study_session_rounds_session_id"))
    op.drop_table("study_session_rounds")
