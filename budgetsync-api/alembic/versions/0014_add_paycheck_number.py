"""add paycheck_number to transactions and budgets

Revision ID: 0014_add_paycheck_number
Revises: 0013_add_paycheck_frequency
Create Date: 2026-04-11
"""

import sqlalchemy as sa

from alembic import op

revision = "0014_add_paycheck_number"
down_revision = "0013_add_paycheck_frequency"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Add paycheck_number to transactions
    tx_columns = {column["name"] for column in inspector.get_columns("transactions")}
    if "paycheck_number" not in tx_columns:
        with op.batch_alter_table("transactions", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("paycheck_number", sa.Integer(), nullable=True)
            )

    # Add paycheck_number to budgets
    budget_columns = {column["name"] for column in inspector.get_columns("budgets")}
    if "paycheck_number" not in budget_columns:
        with op.batch_alter_table("budgets", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("paycheck_number", sa.Integer(), nullable=True)
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Drop paycheck_number from budgets
    budget_columns = {column["name"] for column in inspector.get_columns("budgets")}
    if "paycheck_number" in budget_columns:
        with op.batch_alter_table("budgets", schema=None) as batch_op:
            batch_op.drop_column("paycheck_number")

    # Drop paycheck_number from transactions
    tx_columns = {column["name"] for column in inspector.get_columns("transactions")}
    if "paycheck_number" in tx_columns:
        with op.batch_alter_table("transactions", schema=None) as batch_op:
            batch_op.drop_column("paycheck_number")
