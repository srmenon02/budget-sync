"""add teller token and sync timestamp columns

Revision ID: 0003_add_teller_token_columns
Revises: 0002_add_users
Create Date: 2026-03-30
"""

import sqlalchemy as sa
from alembic import op

revision = "0003_add_teller_token_columns"
down_revision = "0002_add_users"
branch_labels = None
depends_on = None


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("financial_accounts"):
        if not _has_column(inspector, "financial_accounts", "teller_access_token_enc"):
            op.add_column("financial_accounts", sa.Column("teller_access_token_enc", sa.Text(), nullable=True))
        if not _has_column(inspector, "financial_accounts", "last_synced_at"):
            op.add_column("financial_accounts", sa.Column("last_synced_at", sa.String(length=50), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("financial_accounts"):
        if _has_column(inspector, "financial_accounts", "last_synced_at"):
            op.drop_column("financial_accounts", "last_synced_at")
        if _has_column(inspector, "financial_accounts", "teller_access_token_enc"):
            op.drop_column("financial_accounts", "teller_access_token_enc")
