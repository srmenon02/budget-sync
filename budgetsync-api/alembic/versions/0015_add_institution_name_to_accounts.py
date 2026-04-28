"""add institution_name to financial_accounts

Revision ID: 0015_add_institution_name_to_accounts
Revises: 0014_add_paycheck_number
Create Date: 2026-04-12
"""

import sqlalchemy as sa

from alembic import op

revision = "0015_add_institution_name_to_accounts"
down_revision = "0014_add_paycheck_number"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("financial_accounts")}
    if "institution_name" not in columns:
        with op.batch_alter_table("financial_accounts", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("institution_name", sa.String(255), nullable=True)
            )


def downgrade() -> None:
    with op.batch_alter_table("financial_accounts", schema=None) as batch_op:
        batch_op.drop_column("institution_name")
