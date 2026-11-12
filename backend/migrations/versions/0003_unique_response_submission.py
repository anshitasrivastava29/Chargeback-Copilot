"""unique response submission per dispute

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-10 18:20:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '0003'
down_revision: Union[str, Sequence[str], None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enforce one recorded response per dispute at the database level."""
    with op.batch_alter_table('response_submissions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_response_submissions_dispute_id'))
        batch_op.create_index(
            batch_op.f('ix_response_submissions_dispute_id'),
            ['dispute_id'],
            unique=True,
        )


def downgrade() -> None:
    """Restore the non-unique lookup index."""
    with op.batch_alter_table('response_submissions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_response_submissions_dispute_id'))
        batch_op.create_index(
            batch_op.f('ix_response_submissions_dispute_id'),
            ['dispute_id'],
            unique=False,
        )
