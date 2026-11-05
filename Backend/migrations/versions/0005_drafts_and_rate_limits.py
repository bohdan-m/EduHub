"""Server-side course drafts and the shared rate-limit counters.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-04
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "course_drafts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=True),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        # one "new course" draft per user too: NULL course ids count as equal (PostgreSQL 15+)
        sa.UniqueConstraint(
            "user_id", "course_id", name="course_drafts_user_course_unique", postgresql_nulls_not_distinct=True
        ),
    )
    op.create_table(
        "rate_limits",
        sa.Column("key", sa.String(200), primary_key=True),
        sa.Column("window_start", sa.Integer(), primary_key=True),
        sa.Column("hits", sa.Integer(), nullable=False),
    )
    op.create_index("ix_rate_limits_window_start", "rate_limits", ["window_start"])


def downgrade() -> None:
    op.drop_index("ix_rate_limits_window_start", "rate_limits")
    op.drop_table("rate_limits")
    op.drop_table("course_drafts")
