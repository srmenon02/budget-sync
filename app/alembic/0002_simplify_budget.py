"""simplify budget model to single active budget per user

Revision ID: 0002_simplify_budget
Revises: 0001_initial
Create Date: 2025-04-11 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_simplify_budget"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to budgets table
    op.add_column("budgets", sa.Column("name", sa.String(255), nullable=True))
    op.add_column(
        "budgets", sa.Column("total_amount", sa.Numeric(12, 2), nullable=True)
    )
    op.add_column(
        "budgets",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )

    # Drop old budget columns (after data migration, if needed)
    # These will be dropped in a second phase after ensuring no data loss
    # For now, keep them nullable to allow for gradual migration

    # Add budget_id to transactions
    op.add_column(
        "transactions",
        sa.Column("budget_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_transactions_budget_id",
        "transactions",
        "budgets",
        ["budget_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Create budget_archives table
    op.create_table(
        "budget_archives",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("budget_id", sa.UUID(), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column(
            "spent_amount", sa.Numeric(12, 2), nullable=False, server_default="0"
        ),
        sa.Column("transactions_data", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["budget_id"], ["budgets.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Update the index on budgets table (remove old index)
    op.drop_index("ix_budgets_owner_month_year", table_name="budgets")
    # Add new index for active budgets
    op.create_index("ix_budgets_owner_active", "budgets", ["owner_id", "is_active"])


def downgrade() -> None:
    # Drop new index
    op.drop_index("ix_budgets_owner_active", table_name="budgets")
    # Recreate old index
    op.create_index(
        "ix_budgets_owner_month_year", "budgets", ["owner_id", "month", "year"]
    )

    # Drop budget_archives table
    op.drop_table("budget_archives")

    # Remove budget_id from transactions
    op.drop_constraint("fk_transactions_budget_id", "transactions", type_="foreignkey")
    op.drop_column("transactions", "budget_id")

    # Remove new budget columns
    op.drop_column("budgets", "is_active")
    op.drop_column("budgets", "total_amount")
    op.drop_column("budgets", "name")
