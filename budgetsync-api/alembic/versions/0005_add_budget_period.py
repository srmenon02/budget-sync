"""add budget period

Revision ID: 0005_add_budget_period
Revises: 0004_add_budgets_table
Create Date: 2026-04-04
"""

import sqlalchemy as sa
from alembic import op

revision = "0005_add_budget_period"
down_revision = "0004_add_budgets_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = {column["name"] for column in inspector.get_columns("budgets")}
    if "period" not in columns:
        op.add_column(
            "budgets",
            sa.Column("period", sa.String(length=20), nullable=False, server_default="monthly"),
        )

    unique_constraints = {constraint["name"] for constraint in inspector.get_unique_constraints("budgets")}
    with op.batch_alter_table("budgets") as batch_op:
        if "uq_budget_user_category_month_year" in unique_constraints:
            batch_op.drop_constraint("uq_budget_user_category_month_year", type_="unique")
        if "uq_budget_user_category_month_year_period" not in unique_constraints:
            batch_op.create_unique_constraint(
                "uq_budget_user_category_month_year_period",
                ["user_id", "category", "month", "year", "period"],
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    unique_constraints = {constraint["name"] for constraint in inspector.get_unique_constraints("budgets")}
    columns = {column["name"] for column in inspector.get_columns("budgets")}

    with op.batch_alter_table("budgets") as batch_op:
        if "uq_budget_user_category_month_year_period" in unique_constraints:
            batch_op.drop_constraint("uq_budget_user_category_month_year_period", type_="unique")
        if "uq_budget_user_category_month_year" not in unique_constraints:
            batch_op.create_unique_constraint(
                "uq_budget_user_category_month_year",
                ["user_id", "category", "month", "year"],
            )
        if "period" in columns:
            batch_op.drop_column("period")