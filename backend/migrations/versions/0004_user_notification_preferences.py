"""user notification preferences

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-10 21:10:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, Sequence[str], None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Persist workspace notification choices made on the Settings page."""
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "notify_deadline_reminders",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            )
        )
        batch_op.add_column(
            sa.Column(
                "notify_weekly_digest",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            )
        )
        batch_op.add_column(
            sa.Column(
                "notify_case_updates",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            )
        )


def downgrade() -> None:
    """Remove the stored notification choices."""
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("notify_case_updates")
        batch_op.drop_column("notify_weekly_digest")
        batch_op.drop_column("notify_deadline_reminders")
