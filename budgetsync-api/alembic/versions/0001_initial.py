"""initial migration

Revision ID: 0001_initial
Revises:
Create Date: 2026-03-29
"""

import sqlalchemy as sa

from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("financial_accounts"):
        op.create_table(
            "financial_accounts",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("provider", sa.String(length=50), nullable=True),
            sa.Column("external_id", sa.String(length=255), nullable=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("type", sa.String(length=50), nullable=True),
            sa.Column("balance_current", sa.Numeric(12, 2), nullable=True),
            sa.Column(
                "currency", sa.String(length=10), nullable=True, server_default="USD"
            ),
        )

    if not inspector.has_table("transactions"):
        op.create_table(
            "transactions",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("account_id", sa.String(length=36), nullable=True),
            sa.Column("external_id", sa.String(length=255), nullable=True),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("merchant_name", sa.String(length=255), nullable=True),
            sa.Column("category", sa.String(length=100), nullable=True),
            sa.Column("user_category", sa.String(length=100), nullable=True),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("is_manual", sa.Boolean(), nullable=True),
            sa.Column(
                "created_at",
                sa.String(length=50),
                nullable=True,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
        )


def downgrade() -> None:
    op.drop_table("transactions")
    op.drop_table("financial_accounts")
