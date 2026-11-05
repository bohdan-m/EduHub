"""Enrolling, lesson progress, notes and bookmarks, certificates, and the author's view of how a course is doing."""
import secrets
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.auth import CurrentUser
from app.db import get_db
from app.limits import rate_limit
from app.models import Course, Enrollment, Lesson, LessonProgress, QuizAttempt, Review, Stage, User
from app.routers.courses import (
    course_stats,
    detail_options,
    enrollment_out,
    list_options,
    owned_course,
    to_list_items,
    visible_course,
)
from app.schemas import CourseListItemOut, EnrollmentOut, RatingOut

router = APIRouter(tags=["learning"])

Db = Annotated[Session, Depends(get_db)]
# a learner clicks through lessons and types notes (saved as they type), so this is generous
PROGRESS_WRITES = rate_limit("progress-writes", limit=120)


def _enrollable(db: Session, course_id: int, user: User) -> Course:
    course = visible_course(db, course_id, user, *detail_options())
    if course.author_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="This is your own course: preview it instead.")
    if course.status == "draft":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")
    return course


def _enroll(db: Session, course: Course, user: User) -> Enrollment:
    enrollment = db.scalar(select(Enrollment).where(Enrollment.user_id == user.id, Enrollment.course_id == course.id))
    if enrollment is None:
        enrollment = Enrollment(user_id=user.id, course_id=course.id)
        db.add(enrollment)
        try:
            db.flush()
        except IntegrityError:
            # enrolled in a parallel request; use that one
            db.rollback()
            enrollment = db.scalar(
                select(Enrollment).where(Enrollment.user_id == user.id, Enrollment.course_id == course.id)
            )
    return enrollment


@router.post("/courses/{course_id}/enroll/", response_model=EnrollmentOut)
def enroll(course_id: int, db: Db, user: CurrentUser, _limit: Annotated[None, PROGRESS_WRITES]):
    course = _enrollable(db, course_id, user)
    enrollment = _enroll(db, course, user)
    db.commit()
    return enrollment_out(db, enrollment, course)


@router.delete("/courses/{course_id}/enroll/", status_code=status.HTTP_204_NO_CONTENT)
def leave(course_id: int, db: Db, user: CurrentUser):
    """Leaves the course. Progress and notes stay, so enrolling again picks up where the learner left off."""
    enrollment = db.scalar(select(Enrollment).where(Enrollment.user_id == user.id, Enrollment.course_id == course_id))
    if enrollment is not None:
        db.delete(enrollment)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class ProgressIn(BaseModel):
    """Fields left out stay as they are. Any update also marks the lesson as where the learner is."""

    completed: bool | None = None
    bookmarked: bool | None = None
    note: Annotated[str, Field(max_length=5000)] | None = None


class LessonProgressOut(BaseModel):
    completed: bool
    bookmarked: bool
    note: str


class ProgressOut(BaseModel):
    lesson: LessonProgressOut
    enrollment: EnrollmentOut


def _lesson_in(course: Course, lesson_id: int) -> Lesson:
    lesson = next((lesson for stage in course.stages for lesson in stage.lessons if lesson.id == lesson_id), None)
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")
    return lesson


@router.get("/courses/{course_id}/lessons/{lesson_id}/progress/", response_model=LessonProgressOut)
def lesson_progress(course_id: int, lesson_id: int, db: Db, user: CurrentUser):
    course = visible_course(db, course_id, user, *detail_options())
    _lesson_in(course, lesson_id)
    progress = db.get(LessonProgress, (user.id, lesson_id))
    if progress is None:
        return LessonProgressOut(completed=False, bookmarked=False, note="")
    return LessonProgressOut(completed=progress.completed_at is not None, bookmarked=progress.bookmarked, note=progress.note)


@router.put("/courses/{course_id}/lessons/{lesson_id}/progress/", response_model=ProgressOut)
def update_progress(course_id: int, lesson_id: int, body: ProgressIn, db: Db, user: CurrentUser,
                    _limit: Annotated[None, PROGRESS_WRITES]):
    course = _enrollable(db, course_id, user)
    _lesson_in(course, lesson_id)
    enrollment = _enroll(db, course, user)  # opening a lesson of a course enrolls you in it

    now = datetime.now(timezone.utc)
    values = {"user_id": user.id, "lesson_id": lesson_id}
    changes: dict = {}
    if body.completed is not None:
        changes["completed_at"] = now if body.completed else None
    if body.bookmarked is not None:
        changes["bookmarked"] = body.bookmarked
    if body.note is not None:
        changes["note"] = body.note.strip()
    statement = insert(LessonProgress).values(**values, **changes)
    db.execute(statement.on_conflict_do_update(
        index_elements=["user_id", "lesson_id"], set_={**changes, "updated_at": func.now()}
    ))
    enrollment.last_lesson_id = lesson_id
    enrollment.last_seen_at = now

    # finishing the last lesson completes the course and issues the certificate; it stays earned even if lessons
    # are added later
    lesson_ids = [lesson.id for stage in course.stages for lesson in stage.lessons]
    done = db.scalar(select(func.count()).select_from(LessonProgress).where(
        LessonProgress.user_id == user.id, LessonProgress.lesson_id.in_(lesson_ids), LessonProgress.completed_at.is_not(None)
    ))
    if lesson_ids and done == len(lesson_ids) and enrollment.completed_at is None:
        enrollment.completed_at = now
        enrollment.certificate_code = secrets.token_urlsafe(12)
    db.commit()

    progress = db.get(LessonProgress, (user.id, lesson_id))
    db.refresh(progress)
    return ProgressOut(
        lesson=LessonProgressOut(completed=progress.completed_at is not None, bookmarked=progress.bookmarked,
                                 note=progress.note),
        enrollment=enrollment_out(db, enrollment, course),
    )


class LearningItemOut(BaseModel):
    course: CourseListItemOut
    completed_lessons: int
    total_lessons: int
    last_lesson_id: int | None
    last_seen_at: datetime
    completed_at: datetime | None
    certificate_code: str | None


class BookmarkOut(BaseModel):
    course_id: int
    course_title: str
    lesson_id: int
    lesson_title: str
    note: str


class LearningOut(BaseModel):
    courses: list[LearningItemOut]
    bookmarks: list[BookmarkOut]


@router.get("/me/learning/", response_model=LearningOut)
def my_learning(request: Request, db: Db, user: CurrentUser):
    """The courses the user is taking (most recently opened first) and their bookmarked lessons."""
    enrollments = db.scalars(
        select(Enrollment).join(Course).where(Enrollment.user_id == user.id, Course.status != "draft",
                                              Course.is_hidden.is_(False))
        .order_by(Enrollment.last_seen_at.desc())
        .options(selectinload(Enrollment.course).options(*list_options()))
    ).all()
    courses = [enrollment.course for enrollment in enrollments]
    items = {item.id: item for item in to_list_items(db, courses, request)}
    done_counts = dict(db.execute(
        select(Stage.course_id, func.count())
        .select_from(LessonProgress)
        .join(Lesson, Lesson.id == LessonProgress.lesson_id)
        .join(Stage, Stage.id == Lesson.stage_id)
        .where(LessonProgress.user_id == user.id, LessonProgress.completed_at.is_not(None),
               Stage.course_id.in_([course.id for course in courses]))
        .group_by(Stage.course_id)
    ).all())

    bookmarks = db.execute(
        select(Course.id, Course.title, Lesson.id, Lesson.title, LessonProgress.note)
        .select_from(LessonProgress)
        .join(Lesson, Lesson.id == LessonProgress.lesson_id)
        .join(Stage, Stage.id == Lesson.stage_id)
        .join(Course, Course.id == Stage.course_id)
        .where(LessonProgress.user_id == user.id, LessonProgress.bookmarked.is_(True), Course.is_hidden.is_(False),
               Course.status != "draft")
        .order_by(LessonProgress.updated_at.desc())
    ).all()
    return LearningOut(
        courses=[
            LearningItemOut(
                course=items[e.course_id],
                completed_lessons=done_counts.get(e.course_id, 0),
                total_lessons=e.course.lesson_count,
                last_lesson_id=e.last_lesson_id,
                last_seen_at=e.last_seen_at,
                completed_at=e.completed_at,
                certificate_code=e.certificate_code,
            )
            for e in enrollments
        ],
        bookmarks=[
            BookmarkOut(course_id=row[0], course_title=row[1], lesson_id=row[2], lesson_title=row[3], note=row[4])
            for row in bookmarks
        ],
    )


class CertificateOut(BaseModel):
    code: str
    learner_name: str
    course_id: int
    course_title: str
    author_name: str
    lesson_count: int
    completed_at: datetime


@router.get("/certificates/{code}/", response_model=CertificateOut)
def certificate(code: str, db: Db):
    """Public, so anyone given the link (an employer, say) can check it."""
    enrollment = db.scalar(
        select(Enrollment).where(Enrollment.certificate_code == code)
        .options(selectinload(Enrollment.user), selectinload(Enrollment.course).selectinload(Course.author))
    )
    if enrollment is None or enrollment.completed_at is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")
    course = enrollment.course
    return CertificateOut(
        code=code,
        learner_name=enrollment.user.name or "EduHub learner",
        course_id=course.id,
        course_title=course.title,
        author_name=course.author.name if course.author else "EduHub",
        lesson_count=course.lesson_count,
        completed_at=enrollment.completed_at,
    )


# --- the author's side ---------------------------------------------------------------------------------------------


class LessonStatOut(BaseModel):
    id: int
    title: str
    completed: int


class QuizStatOut(BaseModel):
    lesson_id: int
    lesson_title: str
    block_id: str
    question: str
    learners: int
    first_try_correct: int


class CourseStatsOut(BaseModel):
    learners: int
    completed: int
    average_progress: float  # 0..1 across learners
    rating: RatingOut
    rating_distribution: dict[int, int]
    lessons: list[LessonStatOut]
    quizzes: list[QuizStatOut]  # hardest first


@router.get("/courses/{course_id}/stats/", response_model=CourseStatsOut)
def course_stats_view(course_id: int, db: Db, user: CurrentUser):
    course = owned_course(db, course_id, user, *detail_options())
    lessons = [(lesson, stage) for stage in course.stages for lesson in stage.lessons]
    lesson_ids = [lesson.id for lesson, _ in lessons]
    learner_ids = select(Enrollment.user_id).where(Enrollment.course_id == course.id)
    learners = db.scalar(select(func.count()).where(Enrollment.course_id == course.id)) or 0
    completed = db.scalar(
        select(func.count()).where(Enrollment.course_id == course.id, Enrollment.completed_at.is_not(None))
    ) or 0

    done_by_lesson = dict(db.execute(
        select(LessonProgress.lesson_id, func.count())
        .where(LessonProgress.lesson_id.in_(lesson_ids), LessonProgress.completed_at.is_not(None),
               LessonProgress.user_id.in_(learner_ids))
        .group_by(LessonProgress.lesson_id)
    ).all()) if lesson_ids else {}
    total_done = sum(done_by_lesson.values())
    average = total_done / (learners * len(lesson_ids)) if learners and lesson_ids else 0.0

    attempts = {
        (row.lesson_id, row.block_id): (row.learners, row.first_correct)
        for row in db.execute(
            select(QuizAttempt.lesson_id, QuizAttempt.block_id, func.count().label("learners"),
                   func.count().filter(QuizAttempt.first_correct.is_(True)).label("first_correct"))
            .where(QuizAttempt.lesson_id.in_(lesson_ids))
            .group_by(QuizAttempt.lesson_id, QuizAttempt.block_id)
        )
    } if lesson_ids else {}
    quizzes = []
    for lesson, _stage in lessons:
        for block in lesson.blocks:
            if block.get("type") == "quiz" and (lesson.id, block["id"]) in attempts:
                count, first = attempts[(lesson.id, block["id"])]
                quizzes.append(QuizStatOut(lesson_id=lesson.id, lesson_title=lesson.title, block_id=block["id"],
                                           question=block["question"], learners=count, first_try_correct=first))
    quizzes.sort(key=lambda q: q.first_try_correct / q.learners)

    distribution = {stars: 0 for stars in range(1, 6)}
    distribution.update(dict(db.execute(
        select(Review.rating, func.count()).where(Review.course_id == course.id, Review.is_hidden.is_(False))
        .group_by(Review.rating)
    ).all()))
    return CourseStatsOut(
        learners=learners,
        completed=completed,
        average_progress=round(average, 3),
        rating=course_stats(db, [course.id])[course.id][0],
        rating_distribution=distribution,
        lessons=[LessonStatOut(id=lesson.id, title=lesson.title, completed=done_by_lesson.get(lesson.id, 0))
                 for lesson, _ in lessons],
        quizzes=quizzes,
    )


class TeachingItemOut(BaseModel):
    course: CourseListItemOut
    completed: int
    unanswered_reviews: int


@router.get("/me/teaching/", response_model=list[TeachingItemOut])
def my_teaching(request: Request, db: Db, user: CurrentUser):
    """Every course the user wrote, in any state, with how it is doing."""
    courses = db.scalars(
        select(Course).where(Course.author_id == user.id).order_by(Course.updated_at.desc()).options(*list_options())
    ).all()
    ids = [course.id for course in courses]
    completed = dict(db.execute(
        select(Enrollment.course_id, func.count())
        .where(Enrollment.course_id.in_(ids), Enrollment.completed_at.is_not(None))
        .group_by(Enrollment.course_id)
    ).all()) if ids else {}
    unanswered = dict(db.execute(
        select(Review.course_id, func.count())
        .where(Review.course_id.in_(ids), Review.author_reply == "", Review.text != "", Review.is_hidden.is_(False))
        .group_by(Review.course_id)
    ).all()) if ids else {}
    return [
        TeachingItemOut(course=item, completed=completed.get(item.id, 0), unanswered_reviews=unanswered.get(item.id, 0))
        for item in to_list_items(db, list(courses), request)
    ]
