"""Course publishing and details, learner progress, reviews, comments, reports, uploads and author profiles.

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-05
"""
import math

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

NOW = sa.text("now()")


def _minutes(blocks: list[dict]) -> float:
    # frozen copy of app.content.lesson_minutes as it was when this migration was written
    words = sum(len(str(b.get("text", "")).split()) for b in blocks if b.get("type") in ("text", "callout"))
    extra = {"video": 6, "quiz": 1, "link": 2, "file": 2}
    return max(1.0, words / 200 + sum(extra.get(b.get("type"), 0) for b in blocks))


def upgrade() -> None:
    op.add_column("users", sa.Column("headline", sa.String(100), server_default="", nullable=False))
    op.add_column("users", sa.Column("bio", sa.Text(), server_default="", nullable=False))

    # existing courses were public already, so they start out published; new ones start as drafts (app default)
    for column in (
        sa.Column("status", sa.String(12), server_default="published", nullable=False),
        sa.Column("category", sa.String(30), server_default="other", nullable=False),
        sa.Column("level", sa.String(12), server_default="all", nullable=False),
        sa.Column("language", sa.String(10), server_default="en", nullable=False),
        sa.Column("outcomes", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("requirements", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("intro_video_url", sa.String(200), server_default="", nullable=False),
        sa.Column("lesson_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("estimated_minutes", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_hidden", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    ):
        op.add_column("courses", column)
    op.create_check_constraint("courses_status_valid", "courses", "status IN ('draft', 'published', 'unlisted')")
    op.create_check_constraint(
        "courses_level_valid", "courses", "level IN ('all', 'beginner', 'intermediate', 'advanced')"
    )
    op.create_index("ix_courses_status", "courses", ["status"])
    op.create_index("ix_courses_category", "courses", ["category"])

    bind = op.get_bind()
    bind.execute(sa.text("UPDATE courses SET published_at = created_at"))
    totals: dict[int, list[float]] = {}
    rows = bind.execute(sa.text("SELECT s.course_id, l.blocks FROM lessons l JOIN stages s ON s.id = l.stage_id"))
    for course_id, blocks in rows:
        total = totals.setdefault(course_id, [0, 0.0])
        total[0] += 1
        total[1] += _minutes(blocks or [])
    for course_id, (count, minutes) in totals.items():
        bind.execute(
            sa.text("UPDATE courses SET lesson_count = :count, estimated_minutes = :minutes WHERE id = :id"),
            {"count": count, "minutes": math.ceil(minutes), "id": course_id},
        )

    user_fk = sa.ForeignKey("users.id", ondelete="CASCADE")
    op.create_table(
        "uploads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), user_fk, nullable=False, index=True),
        sa.Column("path", sa.String(255), nullable=False, unique=True),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    )
    op.create_table(
        "enrollments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("enrolled_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("last_lesson_id", sa.Integer(), sa.ForeignKey("lessons.id", ondelete="SET NULL"), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("certificate_code", sa.String(32), nullable=True, unique=True),
        sa.UniqueConstraint("user_id", "course_id", name="enrollments_user_course_unique"),
    )
    op.create_table(
        "lesson_progress",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("lesson_id", sa.Integer(), sa.ForeignKey("lessons.id", ondelete="CASCADE"), primary_key=True,
                  index=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("bookmarked", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("note", sa.Text(), server_default="", nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    )
    op.create_table(
        "quiz_attempts",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("lesson_id", sa.Integer(), sa.ForeignKey("lessons.id", ondelete="CASCADE"), primary_key=True,
                  index=True),
        sa.Column("block_id", sa.String(40), primary_key=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("first_correct", sa.Boolean(), nullable=False),
        sa.Column("correct", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    )
    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column("text", sa.Text(), server_default="", nullable=False),
        sa.Column("author_reply", sa.Text(), server_default="", nullable=False),
        sa.Column("is_hidden", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.UniqueConstraint("course_id", "user_id", name="reviews_course_user_unique"),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="reviews_rating_range"),
    )
    op.create_table(
        "comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("lesson_id", sa.Integer(), sa.ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("comments.id", ondelete="CASCADE"), nullable=True,
                  index=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_hidden", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False, index=True),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("reporter_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_type", sa.String(10), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(20), nullable=False),
        sa.Column("details", sa.Text(), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True, index=True),
        sa.UniqueConstraint("reporter_id", "target_type", "target_id", name="reports_reporter_target_unique"),
        sa.CheckConstraint("target_type IN ('course', 'review', 'comment')", name="reports_target_valid"),
    )


def downgrade() -> None:
    for table in ("reports", "comments", "reviews", "quiz_attempts", "lesson_progress", "enrollments", "uploads"):
        op.drop_table(table)
    op.drop_index("ix_courses_category", "courses")
    op.drop_index("ix_courses_status", "courses")
    op.drop_constraint("courses_level_valid", "courses")
    op.drop_constraint("courses_status_valid", "courses")
    for column in (
        "status", "category", "level", "language", "outcomes", "requirements", "intro_video_url", "lesson_count",
        "estimated_minutes", "is_hidden", "published_at", "updated_at",
    ):
        op.drop_column("courses", column)
    op.drop_column("users", "bio")
    op.drop_column("users", "headline")
