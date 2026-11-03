"""Initial schema: users mirror Better Auth accounts; courses, images, stages and lessons.

Revision ID: 0001
Revises:
Create Date: 2026-11-03
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("auth_id", sa.String(255), nullable=False, unique=True),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("role IN ('student', 'teacher')", name="users_role_valid"),
    )
    op.create_table(
        "courses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_courses_author_id", "courses", ["author_id"])
    op.create_index("ix_courses_created_at", "courses", ["created_at"])
    op.create_table(
        "course_images",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("image", sa.String(255), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
    )
    op.create_index("ix_course_images_course_id", "course_images", ["course_id"])
    op.create_table(
        "stages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("course_id", "order", name="stages_course_order_unique"),
        sa.CheckConstraint('"order" BETWEEN 0 AND 100', name="stages_order_range"),
    )
    op.create_index("ix_stages_course_id", "stages", ["course_id"])
    op.create_table(
        "lessons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("url", sa.String(200), nullable=False, server_default=""),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("stage_id", sa.Integer(), sa.ForeignKey("stages.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("stage_id", "order", name="lessons_stage_order_unique"),
        sa.CheckConstraint('"order" BETWEEN 0 AND 100', name="lessons_order_range"),
    )
    op.create_index("ix_lessons_stage_id", "lessons", ["stage_id"])


def downgrade() -> None:
    for table in ("lessons", "stages", "course_images", "courses", "users"):
        op.drop_table(table)
