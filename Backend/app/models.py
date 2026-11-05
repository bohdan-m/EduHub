from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    """Local mirror of a Better Auth account, created on its first authenticated API request."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    auth_id: Mapped[str] = mapped_column(String(255), unique=True)  # Better Auth user id ("sub" in its JWTs)
    email: Mapped[str] = mapped_column(String(254), default="")
    name: Mapped[str] = mapped_column(String(150), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    headline: Mapped[str] = mapped_column(String(100), default="", server_default="")
    bio: Mapped[str] = mapped_column(Text, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    courses: Mapped[list["Course"]] = relationship(back_populates="author", passive_deletes=True)


# Keep in step with app.schemas and Frontend/src/utils/courseMeta.ts
COURSE_STATUSES = ("draft", "published", "unlisted")
COURSE_LEVELS = ("all", "beginner", "intermediate", "advanced")
COURSE_CATEGORIES = (
    "programming", "data", "design", "business", "marketing", "languages", "science", "personal", "other",
)


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'published', 'unlisted')", name="courses_status_valid"),
        CheckConstraint("level IN ('all', 'beginner', 'intermediate', 'advanced')", name="courses_level_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    # draft: only the author sees it; unlisted: anyone with the link; published: also in the catalogue
    status: Mapped[str] = mapped_column(String(12), default="draft", server_default="published", index=True)
    category: Mapped[str] = mapped_column(String(30), default="other", server_default="other", index=True)
    level: Mapped[str] = mapped_column(String(12), default="all", server_default="all")
    language: Mapped[str] = mapped_column(String(10), default="en", server_default="en")
    outcomes: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")  # what learners will be able to do
    requirements: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")
    intro_video_url: Mapped[str] = mapped_column(String(200), default="", server_default="")
    # kept up to date on every save, so the catalogue doesn't load every lesson
    lesson_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # set when enough people report it: the author still sees it, nobody else does until a moderator decides
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    # null for the built-in demo courses, which belong to no account
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    author: Mapped[User | None] = relationship(back_populates="courses")
    images: Mapped[list["CourseImage"]] = relationship(
        back_populates="course", cascade="all, delete-orphan", passive_deletes=True, order_by="CourseImage.id"
    )
    stages: Mapped[list["Stage"]] = relationship(
        back_populates="course", cascade="all, delete-orphan", passive_deletes=True, order_by="Stage.order"
    )


class CourseImage(Base):
    __tablename__ = "course_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    image: Mapped[str] = mapped_column(String(255))  # path relative to MEDIA_ROOT
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)

    course: Mapped[Course] = relationship(back_populates="images")


class Stage(Base):
    __tablename__ = "stages"
    __table_args__ = (
        # deferred to commit, so an edit can swap two positions in one transaction
        UniqueConstraint("course_id", "order", name="stages_course_order_unique", deferrable=True, initially="DEFERRED"),
        CheckConstraint('"order" BETWEEN 0 AND 100', name="stages_order_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    order: Mapped[int] = mapped_column(Integer)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)

    course: Mapped[Course] = relationship(back_populates="stages")
    lessons: Mapped[list["Lesson"]] = relationship(
        back_populates="stage", cascade="all, delete-orphan", passive_deletes=True, order_by="Lesson.order"
    )


class Lesson(Base):
    __tablename__ = "lessons"
    __table_args__ = (
        UniqueConstraint("stage_id", "order", name="lessons_stage_order_unique", deferrable=True, initially="DEFERRED"),
        CheckConstraint('"order" BETWEEN 0 AND 100', name="lessons_order_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    # content blocks (text, video, link, callout, quiz) as validated by app.schemas.Block
    blocks: Mapped[list[dict]] = mapped_column(JSONB, default=list, server_default="[]")
    order: Mapped[int] = mapped_column(Integer)
    stage_id: Mapped[int] = mapped_column(ForeignKey("stages.id", ondelete="CASCADE"), index=True)

    stage: Mapped[Stage] = relationship(back_populates="lessons")


class CourseDraft(Base):
    """Unsaved builder work, one per author and course (course_id null: a course not created yet).
    Stored as the builder's own JSON: a draft may be half-finished, so it isn't validated as a course."""

    __tablename__ = "course_drafts"
    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="course_drafts_user_course_unique", postgresql_nulls_not_distinct=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    data: Mapped[dict] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RateLimitWindow(Base):
    """Request counts per key and fixed time window, shared by every API worker (see app.limits)."""

    __tablename__ = "rate_limits"

    key: Mapped[str] = mapped_column(String(200), primary_key=True)
    window_start: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    hits: Mapped[int] = mapped_column(Integer)


class Upload(Base):
    """A file an author added to a lesson (image or attachment). Lesson blocks refer to it by `path`."""

    __tablename__ = "uploads"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    path: Mapped[str] = mapped_column(String(255), unique=True)  # relative to MEDIA_ROOT
    kind: Mapped[str] = mapped_column(String(10))  # image | file
    name: Mapped[str] = mapped_column(String(200))  # the original file name, shown to learners
    size: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("user_id", "course_id", name="enrollments_user_course_unique"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_lesson_id: Mapped[int | None] = mapped_column(ForeignKey("lessons.id", ondelete="SET NULL"))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # public id of the completion certificate; set when the last lesson is completed
    certificate_code: Mapped[str | None] = mapped_column(String(32), unique=True)

    user: Mapped[User] = relationship()
    course: Mapped[Course] = relationship()


class LessonProgress(Base):
    """One learner's state in one lesson: done or not, bookmarked, and private notes."""

    __tablename__ = "lesson_progress"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), primary_key=True, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    bookmarked: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    note: Mapped[str] = mapped_column(Text, default="", server_default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class QuizAttempt(Base):
    """A signed-in learner's answers to one quiz; the first try feeds the author's "most missed" stats."""

    __tablename__ = "quiz_attempts"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), primary_key=True, index=True)
    block_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    attempts: Mapped[int] = mapped_column(Integer, default=1)
    first_correct: Mapped[bool] = mapped_column(Boolean)
    correct: Mapped[bool] = mapped_column(Boolean)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("course_id", "user_id", name="reviews_course_user_unique"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="reviews_rating_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    rating: Mapped[int] = mapped_column(SmallInteger)
    text: Mapped[str] = mapped_column(Text, default="", server_default="")
    author_reply: Mapped[str] = mapped_column(Text, default="", server_default="")  # the course author's answer
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped[User] = relationship()


class Comment(Base):
    """A question or remark under a lesson; replies are one level deep."""

    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("comments.id", ondelete="CASCADE"), index=True)
    body: Mapped[str] = mapped_column(Text)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()


class Report(Base):
    """Someone flagged a course, review or comment. Enough open reports hide it until a moderator decides."""

    __tablename__ = "reports"
    __table_args__ = (
        UniqueConstraint("reporter_id", "target_type", "target_id", name="reports_reporter_target_unique"),
        CheckConstraint("target_type IN ('course', 'review', 'comment')", name="reports_target_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    target_type: Mapped[str] = mapped_column(String(10))
    target_id: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(20))
    details: Mapped[str] = mapped_column(Text, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
