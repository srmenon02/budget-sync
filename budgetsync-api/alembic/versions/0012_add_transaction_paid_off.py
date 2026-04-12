"""add is_paid_off column to transactions for credit card tracking

Revision ID: 0012_add_transaction_paid_off
Revises: 0011_add_credit_card_columns
Create Date: 2026-04-11
"""

import sqlalchemy as sa

from alembic import op

revision = "0012_add_transaction_paid_off"
down_revision = "0011_add_credit_card_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    tx_columns = {column["name"] for column in inspector.get_columns("transactions")}
    if "is_paid_off" not in tx_columns:
        with op.batch_alter_table("transactions", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("is_paid_off", sa.Boolean(), nullable=False, server_default="0")
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    tx_columns = {column["name"] for column in inspector.get_columns("transactions")}
    if "is_paid_off" in tx_columns:
        with op.batch_alter_table("transactions", schema=None) as batch_op:
            batch_op.drop_column("is_paid_off")
