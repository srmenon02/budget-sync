"""add interest rate to loans

Revision ID: 0010_add_interest_rate_to_loans
Revises: 0009_add_loan_id_to_transactions
Create Date: 2026-04-05
"""

import sqlalchemy as sa

from alembic import op

revision = "0010_add_interest_rate_to_loans"
down_revision = "0009_add_loan_id_to_transactions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("loans")}

    if "interest_rate" not in columns:
        with op.batch_alter_table("loans", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column(
                    "interest_rate",
                    sa.Float(),
                    nullable=False,
                    server_default="0",
                )
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("loans")}

    if "interest_rate" in columns:
        with op.batch_alter_table("loans", schema=None) as batch_op:
            batch_op.drop_column("interest_rate")
