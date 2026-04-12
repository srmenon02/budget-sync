"""add budgets table

Revision ID: 0004_add_budgets_table
Revises: 0003_add_teller_token_columns
Create Date: 2026-04-01
"""

import sqlalchemy as sa

from alembic import op

revision = "0004_add_budgets_table"
down_revision = "0003_add_teller_token_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("budgets"):
        op.create_table(
            "budgets",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("category", sa.String(length=100), nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("month", sa.String(length=7), nullable=False),
            sa.Column("year", sa.String(length=4), nullable=False),
            sa.Column(
                "created_at",
                sa.String(length=50),
                nullable=True,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.UniqueConstraint(
                "user_id",
                "category",
                "month",
                "year",
                name="uq_budget_user_category_month_year",
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("budgets"):
        op.drop_table("budgets")
