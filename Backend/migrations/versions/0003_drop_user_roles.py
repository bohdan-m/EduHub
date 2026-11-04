"""Drop user roles: every account can create and manage its own courses.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-04
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("users_role_valid", "users", type_="check")
    op.drop_column("users", "role")


def downgrade() -> None:
    # everyone who could create courses before roles were dropped becomes a teacher again
    op.add_column("users", sa.Column("role", sa.String(10), nullable=False, server_default="teacher"))
    op.alter_column("users", "role", server_default=None)
    op.create_check_constraint("users_role_valid", "users", "role IN ('student', 'teacher')")
