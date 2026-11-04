from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    courses: Mapped[list["Course"]] = relationship(back_populates="author", passive_deletes=True)


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
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
