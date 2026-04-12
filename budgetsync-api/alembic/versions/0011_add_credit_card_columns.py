"""add credit card and transaction type columns

Revision ID: 0011_add_credit_card_columns
Revises: 0010_add_interest_rate_to_loans
Create Date: 2026-04-05
"""

import sqlalchemy as sa

from alembic import op

revision = "0011_add_credit_card_columns"
down_revision = "0010_add_interest_rate_to_loans"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    account_columns = {column["name"] for column in inspector.get_columns("financial_accounts")}
    with op.batch_alter_table("financial_accounts", schema=None) as batch_op:
        if "account_class" not in account_columns:
            batch_op.add_column(
                sa.Column("account_class", sa.String(length=20), nullable=False, server_default="asset")
            )
        if "credit_limit" not in account_columns:
            batch_op.add_column(sa.Column("credit_limit", sa.Numeric(12, 2), nullable=True))
        if "statement_due_day" not in account_columns:
            batch_op.add_column(sa.Column("statement_due_day", sa.Integer(), nullable=True))
        if "minimum_due" not in account_columns:
            batch_op.add_column(sa.Column("minimum_due", sa.Numeric(12, 2), nullable=True))
        if "apr" not in account_columns:
            batch_op.add_column(sa.Column("apr", sa.Float(), nullable=True))

    tx_columns = {column["name"] for column in inspector.get_columns("transactions")}
    if "tx_type" not in tx_columns:
        with op.batch_alter_table("transactions", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("tx_type", sa.String(length=20), nullable=False, server_default="expense")
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    tx_columns = {column["name"] for column in inspector.get_columns("transactions")}
    if "tx_type" in tx_columns:
        with op.batch_alter_table("transactions", schema=None) as batch_op:
            batch_op.drop_column("tx_type")

    account_columns = {column["name"] for column in inspector.get_columns("financial_accounts")}
    with op.batch_alter_table("financial_accounts", schema=None) as batch_op:
        if "apr" in account_columns:
            batch_op.drop_column("apr")
        if "minimum_due" in account_columns:
            batch_op.drop_column("minimum_due")
        if "statement_due_day" in account_columns:
            batch_op.drop_column("statement_due_day")
        if "credit_limit" in account_columns:
            batch_op.drop_column("credit_limit")
        if "account_class" in account_columns:
            batch_op.drop_column("account_class")
