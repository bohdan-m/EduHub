"""Lessons hold content blocks instead of one YouTube link; stage/lesson order constraints become deferrable.

Each lesson's old link becomes a single video block, so existing courses look the same.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-04
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def _order_constraints(deferrable: bool) -> None:
    for table, parent, name in (("stages", "course_id", "stages_course_order_unique"),
                                ("lessons", "stage_id", "lessons_stage_order_unique")):
        op.drop_constraint(name, table, type_="unique")
        extra = {"deferrable": True, "initially": "DEFERRED"} if deferrable else {}
        op.create_unique_constraint(name, table, [parent, "order"], **extra)


def upgrade() -> None:
    op.add_column("lessons", sa.Column("blocks", postgresql.JSONB(), nullable=False, server_default="[]"))
    op.execute("""
        UPDATE lessons
        SET blocks = jsonb_build_array(jsonb_build_object(
            'type', 'video', 'id', md5(id::text || url), 'url', url, 'caption', ''))
        WHERE url <> ''
    """)
    op.drop_column("lessons", "url")
    _order_constraints(deferrable=True)


def downgrade() -> None:
    _order_constraints(deferrable=False)
    op.add_column("lessons", sa.Column("url", sa.String(200), nullable=False, server_default=""))
    # only the first video survives; other blocks have no place in the old schema
    op.execute("""
        UPDATE lessons SET url = LEFT(COALESCE((
            SELECT block->>'url' FROM jsonb_array_elements(blocks) AS block
            WHERE block->>'type' = 'video' LIMIT 1), ''), 200)
    """)
    op.drop_column("lessons", "blocks")
