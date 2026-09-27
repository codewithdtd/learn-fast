"""add_is_ai_generated_to_study_sheets

Revision ID: 884cc5f57564
Revises: a7b1c3d4e5f6
Create Date: 2026-09-28 00:22:30.204806

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '884cc5f57564'
down_revision: Union[str, Sequence[str], None] = 'a7b1c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'study_sheets',
        sa.Column('is_ai_generated', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('study_sheets', 'is_ai_generated')
