"""add paycheck_frequency to users table

Revision ID: 0013_add_paycheck_frequency
Revises: 0012_add_transaction_paid_off
Create Date: 2026-04-11
"""

import sqlalchemy as sa

from alembic import op

revision = "0013_add_paycheck_frequency"
down_revision = "0012_add_transaction_paid_off"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "paycheck_frequency" not in user_columns:
        with op.batch_alter_table("users", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column(
                    "paycheck_frequency",
                    sa.String(length=20),
                    nullable=False,
                    server_default="monthly",
                )
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "paycheck_frequency" in user_columns:
        with op.batch_alter_table("users", schema=None) as batch_op:
            batch_op.drop_column("paycheck_frequency")
