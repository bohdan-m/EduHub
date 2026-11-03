"""Copy data from the old Django tables (if this database had them), then drop those tables.

Only accounts that came from Better Auth (users_user.auth_id set) are kept; courses by any other
legacy account keep their content and become author-less, like the demo courses. Everything runs in
the migration's transaction, so a failure leaves the database as it was.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-03
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

COPY_SQL = [
    """
    INSERT INTO users (id, auth_id, email, name, role, is_active, created_at)
    SELECT id, auth_id, email, LEFT(COALESCE(NULLIF(first_name, ''), username), 150), role, is_active, date_joined
    FROM users_user
    WHERE auth_id IS NOT NULL AND role IN ('student', 'teacher')
    """,
    """
    INSERT INTO courses (id, title, description, author_id, created_at)
    SELECT c.id, c.title, c.description, u.id, c.created_at
    FROM courses_course c
    LEFT JOIN users u ON u.id = c.author_id
    """,
    "INSERT INTO course_images (id, image, course_id) SELECT id, image, course_id FROM courses_courseimage",
    'INSERT INTO stages (id, title, "order", course_id) SELECT id, title, "order", course_id FROM courses_stage',
    'INSERT INTO lessons (id, title, url, "order", stage_id) SELECT id, title, url, "order", stage_id FROM courses_lesson',
]

# Django's own bookkeeping plus this project's former apps; Better Auth's tables live in the "auth" schema
LEGACY_TABLE_PATTERNS = ("django\\_%", "auth\\_%", "users\\_user%", "courses\\_%", "token\\_blacklist\\_%")


def upgrade() -> None:
    connection = op.get_bind()
    has_legacy = connection.scalar(
        sa.text("SELECT to_regclass('public.courses_course') IS NOT NULL AND to_regclass('public.users_user') IS NOT NULL")
    )
    if has_legacy:
        for statement in COPY_SQL:
            connection.execute(sa.text(statement))
        # copied rows kept their ids, so move each id sequence past them
        for table in ("users", "courses", "course_images", "stages", "lessons"):
            connection.execute(
                sa.text(
                    f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                    f"COALESCE((SELECT MAX(id) FROM {table}), 1), (SELECT MAX(id) FROM {table}) IS NOT NULL)"
                )
            )

    legacy_tables = connection.scalars(
        sa.text(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND ("
            + " OR ".join(f"tablename LIKE '{pattern}'" for pattern in LEGACY_TABLE_PATTERNS)
            + ")"
        )
    ).all()
    for table in legacy_tables:
        connection.execute(sa.text(f'DROP TABLE IF EXISTS public."{table}" CASCADE'))


def downgrade() -> None:
    # the Django schema is gone for good; restore from a backup if it is ever needed again
    pass
