"""add users table

Revision ID: 0002_add_users
Revises: 0001_initial
Create Date: 2026-03-29
"""
import sqlalchemy as sa
from alembic import op

revision = "0002_add_users"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("users"):
        op.create_table(
            "users",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("email", sa.String(length=255), nullable=False, unique=True),
            sa.Column("display_name", sa.String(length=255), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=True),
            sa.Column(
                "created_at",
                sa.String(length=50),
                nullable=True,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
        )


def downgrade() -> None:
    op.drop_table("users")
