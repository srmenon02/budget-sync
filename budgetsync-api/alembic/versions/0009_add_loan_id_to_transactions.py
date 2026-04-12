"""add loan_id to transactions table

Revision ID: 0009_add_loan_id_to_transactions
Revises: 0008_simplify_loans
Create Date: 2026-04-05
"""

import sqlalchemy as sa

from alembic import op

revision = "0009_add_loan_id_to_transactions"
down_revision = "0008_simplify_loans"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # For SQLite, use batch mode to add column with foreign key
    with op.batch_alter_table("transactions", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "loan_id",
                sa.String(length=36),
                nullable=True,
                comment="Link to loan for auto-balance updates on loan payments",
            )
        )
        batch_op.create_foreign_key(
            "fk_transactions_loan_id",
            "loans",
            ["loan_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("transactions", schema=None) as batch_op:
        batch_op.drop_constraint("fk_transactions_loan_id", type_="foreignkey")
        batch_op.drop_column("loan_id")
