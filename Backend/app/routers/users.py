"""The signed-in user's profile and data, public author pages, lesson uploads, and removing a deleted account."""
import hmac
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.auth import CurrentUser
from app.config import get_settings
from app.db import get_db
from app.limits import rate_limit
from app.media import delete_images, media_url, save_lesson_upload
from app.models import (
    Comment,
    Course,
    CourseDraft,
    CourseImage,
    Enrollment,
    Lesson,
    LessonProgress,
    QuizAttempt,
    Review,
    Stage,
    Upload,
    User,
)
from app.routers.community import is_admin
from app.routers.courses import catalogue_filter, course_stats, list_options, to_list_items
from app.schemas import CourseListItemOut, RatingOut, optional_text

router = APIRouter(tags=["users"])

Db = Annotated[Session, Depends(get_db)]
UPLOADS = rate_limit("uploads", limit=30)
# shortcut: files removed from a lesson stay on disk until the account is deleted; the quota bounds it
UPLOAD_QUOTA_BYTES = 500 * 1024 * 1024


class MeOut(BaseModel):
    id: int
    name: str
    email: str
    headline: str
    bio: str
    is_admin: bool


class ProfileIn(BaseModel):
    headline: Annotated[str, optional_text(100)] = ""
    bio: Annotated[str, optional_text(1000)] = ""


def _me(user: User) -> MeOut:
    return MeOut(id=user.id, name=user.name, email=user.email, headline=user.headline, bio=user.bio,
                 is_admin=is_admin(user))


@router.get("/me/", response_model=MeOut)
def me(user: CurrentUser):
    return _me(user)


@router.patch("/me/", response_model=MeOut)
def update_profile(body: ProfileIn, db: Db, user: CurrentUser):
    """Headline and bio shown on the user's author page. Name and email belong to the sign-in service."""
    user.headline, user.bio = body.headline, body.bio
    db.commit()
    return _me(user)


@router.get("/me/export/")
def export_my_data(db: Db, user: CurrentUser):
    """Everything the API keeps about the user, as one JSON document (GDPR data portability)."""
    def rows(query):
        return [dict(row._mapping) for row in db.execute(query)]

    courses = db.scalars(
        select(Course).where(Course.author_id == user.id)
        .options(selectinload(Course.stages).selectinload(Stage.lessons))
    ).all()
    lesson_course = select(Lesson.id, Lesson.title.label("lesson_title"), Stage.course_id).join(Stage).subquery()
    return {
        "exported_at": datetime.now().astimezone().isoformat(),
        "profile": {"name": user.name, "email": user.email, "headline": user.headline, "bio": user.bio,
                    "joined": user.created_at.isoformat()},
        "courses": [
            {"id": c.id, "title": c.title, "description": c.description, "status": c.status,
             "category": c.category, "level": c.level, "outcomes": c.outcomes, "requirements": c.requirements,
             "stages": [{"title": s.title, "lessons": [{"title": lesson.title, "blocks": lesson.blocks}
                                                       for lesson in s.lessons]} for s in c.stages]}
            for c in courses
        ],
        "enrollments": rows(select(Enrollment.course_id, Course.title, Enrollment.enrolled_at, Enrollment.completed_at,
                                   Enrollment.certificate_code).join(Course).where(Enrollment.user_id == user.id)),
        "lesson_progress": rows(
            select(lesson_course.c.course_id, LessonProgress.lesson_id, lesson_course.c.lesson_title,
                   LessonProgress.completed_at, LessonProgress.bookmarked, LessonProgress.note)
            .join(lesson_course, lesson_course.c.id == LessonProgress.lesson_id).where(LessonProgress.user_id == user.id)
        ),
        "quiz_attempts": rows(select(QuizAttempt.lesson_id, QuizAttempt.block_id, QuizAttempt.attempts,
                                     QuizAttempt.first_correct, QuizAttempt.correct)
                              .where(QuizAttempt.user_id == user.id)),
        "reviews": rows(select(Review.course_id, Review.rating, Review.text, Review.created_at)
                        .where(Review.user_id == user.id)),
        "comments": rows(select(Comment.lesson_id, Comment.body, Comment.created_at).where(Comment.user_id == user.id)),
        "drafts": rows(select(CourseDraft.course_id, CourseDraft.data, CourseDraft.updated_at)
                       .where(CourseDraft.user_id == user.id)),
        "uploads": rows(select(Upload.name, Upload.kind, Upload.size, Upload.created_at).where(Upload.user_id == user.id)),
    }


class AuthorProfileOut(BaseModel):
    id: int
    name: str
    headline: str
    bio: str
    joined: datetime
    course_count: int
    learner_count: int
    rating: RatingOut
    courses: list[CourseListItemOut]


@router.get("/users/{user_id}/", response_model=AuthorProfileOut)
def author_profile(user_id: int, request: Request, db: Db):
    """A public author page: who they are and their published courses."""
    author = db.get(User, user_id)
    if author is None or not author.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")
    courses = db.scalars(
        select(Course).where(Course.author_id == author.id, *catalogue_filter())
        .order_by(Course.published_at.desc().nulls_last()).options(*list_options())
    ).all()
    items = to_list_items(db, list(courses), request)
    stats = course_stats(db, [course.id for course in courses])
    rated = [rating for rating, _ in stats.values() if rating.count]
    count = sum(rating.count for rating in rated)
    average = round(sum(rating.average * rating.count for rating in rated) / count, 2) if count else None
    return AuthorProfileOut(
        id=author.id, name=author.name or "EduHub author", headline=author.headline, bio=author.bio,
        joined=author.created_at, course_count=len(items), learner_count=sum(learners for _, learners in stats.values()),
        rating=RatingOut(average=average, count=count), courses=items,
    )


class UploadOut(BaseModel):
    path: str
    url: str
    name: str
    size: int
    kind: str


@router.post("/uploads/", response_model=UploadOut, status_code=status.HTTP_201_CREATED)
def upload(request: Request, file: UploadFile, db: Db, user: CurrentUser, _limit: Annotated[None, UPLOADS],
           kind: Annotated[Literal["image", "file"], Query()] = "image"):
    """An image or attachment for a lesson block. Images are re-encoded (metadata dropped); files are checked
    against their type's signature."""
    used = db.scalar(select(func.coalesce(func.sum(Upload.size), 0)).where(Upload.user_id == user.id))
    if used >= UPLOAD_QUOTA_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="file: You've used your 500 MB of uploads.")
    path, name, size = save_lesson_upload(file, kind)
    try:
        db.add(Upload(user_id=user.id, path=path, kind=kind, name=name, size=size))
        db.commit()
    except Exception:
        db.rollback()
        delete_images([path])
        raise
    return UploadOut(path=path, url=media_url(request, path), name=name, size=size, kind=kind)


@router.delete("/internal/users/{auth_id}/", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
def remove_deleted_account(auth_id: str, db: Db, x_internal_secret: Annotated[str, Header()] = ""):
    """Called by the Next.js server while Better Auth deletes an account: the user's courses, progress, reviews,
    comments and files go with it. Only the Next.js server knows the shared secret."""
    secret = get_settings().internal_api_secret
    if not secret or not hmac.compare_digest(x_internal_secret.encode(), secret.encode()):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")
    user = db.scalar(select(User).where(User.auth_id == auth_id))
    if user is not None:
        files = list(db.scalars(select(Upload.path).where(Upload.user_id == user.id)))
        files += db.scalars(select(CourseImage.image).join(Course).where(Course.author_id == user.id)).all()
        db.delete(user)  # rows cascade in the database
        db.commit()
        delete_images(files)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
