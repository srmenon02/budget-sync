"""add loans and loan_payments tables

Revision ID: 0007_add_loans_table
Revises: 0006_add_user_payday_settings
Create Date: 2026-04-05
"""

import sqlalchemy as sa
from alembic import op

revision = "0007_add_loans_table"
down_revision = "0006_add_user_payday_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("loans"):
        op.create_table(
            "loans",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("description", sa.String(length=500), nullable=True),
            sa.Column("principal_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("current_balance", sa.Numeric(12, 2), nullable=False),
            sa.Column("interest_rate", sa.Float(), nullable=False),
            sa.Column("monthly_payment", sa.Numeric(12, 2), nullable=True),
            sa.Column("start_date", sa.String(length=10), nullable=False),
            sa.Column("target_payoff_date", sa.String(length=10), nullable=True),
            sa.Column(
                "created_at",
                sa.String(length=50),
                nullable=True,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column(
                "updated_at",
                sa.String(length=50),
                nullable=True,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
        )

    if not inspector.has_table("loan_payments"):
        op.create_table(
            "loan_payments",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("loan_id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("amount_paid", sa.Numeric(12, 2), nullable=False),
            sa.Column("principal_paid", sa.Numeric(12, 2), nullable=True),
            sa.Column("interest_paid", sa.Numeric(12, 2), nullable=True),
            sa.Column("payment_date", sa.String(length=10), nullable=False),
            sa.Column("notes", sa.String(length=500), nullable=True),
            sa.Column(
                "created_at",
                sa.String(length=50),
                nullable=True,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.ForeignKeyConstraint(["loan_id"], ["loans.id"], ondelete="CASCADE"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("loan_payments"):
        op.drop_table("loan_payments")

    if inspector.has_table("loans"):
        op.drop_table("loans")
