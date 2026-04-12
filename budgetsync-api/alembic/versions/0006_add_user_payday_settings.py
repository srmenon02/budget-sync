"""add user payday settings

Revision ID: 0006_add_user_payday_settings
Revises: 0005_add_budget_period
Create Date: 2026-04-04
"""

import sqlalchemy as sa

from alembic import op

revision = "0006_add_user_payday_settings"
down_revision = "0005_add_budget_period"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}

    if "primary_payday_day" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "primary_payday_day", sa.Integer(), nullable=False, server_default="1"
            ),
        )
    if "secondary_payday_day" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "secondary_payday_day",
                sa.Integer(),
                nullable=False,
                server_default="15",
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}

    with op.batch_alter_table("users") as batch_op:
        if "secondary_payday_day" in columns:
            batch_op.drop_column("secondary_payday_day")
        if "primary_payday_day" in columns:
            batch_op.drop_column("primary_payday_day")
