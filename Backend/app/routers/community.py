"""Reviews, lesson comments, reports, and the moderators' queue."""
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.auth import CurrentUser, OptionalUser
from app.config import get_settings
from app.db import get_db
from app.limits import rate_limit
from app.media import delete_images
from app.models import Comment, Course, Enrollment, Lesson, LessonProgress, Report, Review, Stage, User
from app.routers.courses import can_view, detail_options, visible_course
from app.schemas import optional_text, required_text

router = APIRouter(tags=["community"])

Db = Annotated[Session, Depends(get_db)]
POSTS = rate_limit("community-posts", limit=10)  # reviews, comments and reports: a person writes a few a minute
# distinct people reporting the same thing before it is hidden pending a moderator
HIDE_AFTER_REPORTS = 3


class PersonOut(BaseModel):
    id: int
    name: str


def _person(user: User) -> PersonOut:
    return PersonOut(id=user.id, name=user.name or "EduHub learner")


def is_admin(user: User | None) -> bool:
    return user is not None and bool(user.email) and user.email.lower() in get_settings().admin_emails_set


# --- reviews -------------------------------------------------------------------------------------------------------


class ReviewIn(BaseModel):
    rating: Annotated[int, Field(ge=1, le=5)]
    text: Annotated[str, optional_text(2000)] = ""


class ReplyIn(BaseModel):
    text: Annotated[str, optional_text(2000)]


class ReviewOut(BaseModel):
    id: int
    rating: int
    text: str
    author_reply: str
    created_at: datetime
    updated_at: datetime
    reviewer: PersonOut
    is_mine: bool
    is_hidden: bool


class ReviewPage(BaseModel):
    count: int
    distribution: dict[int, int]
    results: list[ReviewOut]


def _review_out(review: Review, user: User | None) -> ReviewOut:
    return ReviewOut(
        id=review.id, rating=review.rating, text=review.text, author_reply=review.author_reply,
        created_at=review.created_at, updated_at=review.updated_at, reviewer=_person(review.user),
        is_mine=user is not None and review.user_id == user.id, is_hidden=review.is_hidden,
    )


@router.get("/courses/{course_id}/reviews/", response_model=ReviewPage)
def list_reviews(course_id: int, db: Db, user: OptionalUser,
                 limit: Annotated[int, Query(ge=1, le=50)] = 10, offset: Annotated[int, Query(ge=0)] = 0):
    course = visible_course(db, course_id, user)
    shown = (Review.course_id == course.id, Review.is_hidden.is_(False))
    reviews = db.scalars(
        select(Review).where(*shown).order_by(Review.updated_at.desc(), Review.id.desc())
        .options(selectinload(Review.user)).limit(limit).offset(offset)
    ).all()
    distribution = {stars: 0 for stars in range(1, 6)}
    distribution.update(dict(db.execute(select(Review.rating, func.count()).where(*shown).group_by(Review.rating)).all()))
    return ReviewPage(count=sum(distribution.values()), distribution=distribution,
                      results=[_review_out(review, user) for review in reviews])


@router.get("/courses/{course_id}/reviews/mine/", response_model=ReviewOut)
def my_review(course_id: int, db: Db, user: CurrentUser):
    review = db.scalar(select(Review).where(Review.course_id == course_id, Review.user_id == user.id)
                       .options(selectinload(Review.user)))
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No review yet.")
    return _review_out(review, user)


@router.put("/courses/{course_id}/reviews/", response_model=ReviewOut)
def save_review(course_id: int, body: ReviewIn, db: Db, user: CurrentUser, _limit: Annotated[None, POSTS]):
    """Adds or replaces the user's review. Only learners who finished at least one lesson can review."""
    course = visible_course(db, course_id, user)
    if course.author_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="You can't review your own course.")
    took_part = db.scalar(
        select(func.count()).select_from(LessonProgress)
        .join(Lesson, Lesson.id == LessonProgress.lesson_id).join(Stage, Stage.id == Lesson.stage_id)
        .where(LessonProgress.user_id == user.id, Stage.course_id == course.id, LessonProgress.completed_at.is_not(None))
    )
    enrolled = db.scalar(select(Enrollment.id).where(Enrollment.user_id == user.id, Enrollment.course_id == course.id))
    if not enrolled or not took_part:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Finish at least one lesson before reviewing the course.")

    review = db.scalar(select(Review).where(Review.course_id == course.id, Review.user_id == user.id))
    if review is None:
        review = Review(course_id=course.id, user_id=user.id, rating=body.rating, text=body.text)
        db.add(review)
    else:
        review.rating, review.text = body.rating, body.text
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Your review was just saved elsewhere. Reload to see it.")
    db.refresh(review)
    return _review_out(review, user)


@router.delete("/courses/{course_id}/reviews/", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(course_id: int, db: Db, user: CurrentUser):
    review = db.scalar(select(Review).where(Review.course_id == course_id, Review.user_id == user.id))
    if review is not None:
        db.delete(review)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/reviews/{review_id}/reply/", response_model=ReviewOut)
def reply_to_review(review_id: int, body: ReplyIn, db: Db, user: CurrentUser, _limit: Annotated[None, POSTS]):
    """The course's author answers a review publicly; an empty text removes the answer."""
    review = db.scalar(select(Review).join(Course).where(Review.id == review_id, Course.author_id == user.id)
                       .options(selectinload(Review.user)))
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")
    review.author_reply = body.text
    db.commit()
    db.refresh(review)
    return _review_out(review, user)


# --- comments ------------------------------------------------------------------------------------------------------


class CommentIn(BaseModel):
    body: Annotated[str, required_text(2000)]
    parent_id: int | None = None


class CommentEditIn(BaseModel):
    body: Annotated[str, required_text(2000)]


class CommentOut(BaseModel):
    id: int
    body: str
    created_at: datetime
    edited_at: datetime | None
    author: PersonOut
    is_course_author: bool
    can_edit: bool
    can_delete: bool
    replies: list["CommentOut"] = Field(default_factory=list)


class CommentPage(BaseModel):
    count: int
    results: list[CommentOut]


def _lesson_of(db: Session, course_id: int, lesson_id: int, user: User | None) -> tuple[Course, Lesson]:
    course = visible_course(db, course_id, user, *detail_options())
    lesson = next((lesson for stage in course.stages for lesson in stage.lessons if lesson.id == lesson_id), None)
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")
    return course, lesson


def _comment_out(comment: Comment, course: Course, user: User | None, replies: list[Comment] = ()) -> CommentOut:
    mine = user is not None and comment.user_id == user.id
    return CommentOut(
        id=comment.id, body=comment.body, created_at=comment.created_at, edited_at=comment.edited_at,
        author=_person(comment.user), is_course_author=comment.user_id == course.author_id,
        can_edit=mine, can_delete=mine or (user is not None and course.author_id == user.id) or is_admin(user),
        replies=[_comment_out(reply, course, user) for reply in replies],
    )


@router.get("/courses/{course_id}/lessons/{lesson_id}/comments/", response_model=CommentPage)
def list_comments(course_id: int, lesson_id: int, db: Db, user: OptionalUser,
                  limit: Annotated[int, Query(ge=1, le=50)] = 20, offset: Annotated[int, Query(ge=0)] = 0):
    """Newest threads first; replies in the order they were written."""
    course, lesson = _lesson_of(db, course_id, lesson_id, user)
    shown = (Comment.lesson_id == lesson.id, Comment.is_hidden.is_(False))
    count = db.scalar(select(func.count()).where(*shown, Comment.parent_id.is_(None)))
    threads = db.scalars(
        select(Comment).where(*shown, Comment.parent_id.is_(None)).order_by(Comment.created_at.desc(), Comment.id.desc())
        .options(selectinload(Comment.user)).limit(limit).offset(offset)
    ).all()
    replies: dict[int, list[Comment]] = {}
    if threads:
        for reply in db.scalars(
            select(Comment).where(*shown, Comment.parent_id.in_([t.id for t in threads]))
            .order_by(Comment.created_at, Comment.id).options(selectinload(Comment.user))
        ):
            replies.setdefault(reply.parent_id, []).append(reply)
    return CommentPage(count=count, results=[_comment_out(t, course, user, replies.get(t.id, [])) for t in threads])


@router.post("/courses/{course_id}/lessons/{lesson_id}/comments/", response_model=CommentOut,
             status_code=status.HTTP_201_CREATED)
def add_comment(course_id: int, lesson_id: int, body: CommentIn, db: Db, user: CurrentUser,
                _limit: Annotated[None, POSTS]):
    course, lesson = _lesson_of(db, course_id, lesson_id, user)
    if course.status == "draft":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Comments open once the course is published.")
    if body.parent_id is not None:
        parent = db.get(Comment, body.parent_id)
        # replies stay one level deep, under a visible comment of the same lesson
        if parent is None or parent.lesson_id != lesson.id or parent.parent_id is not None or parent.is_hidden:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="parent_id: Reply to a comment on this lesson.")
    comment = Comment(lesson_id=lesson.id, user_id=user.id, parent_id=body.parent_id, body=body.body)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _comment_out(comment, course, user)


def _comment_with_course(db: Session, comment_id: int, user: User) -> tuple[Comment, Course]:
    row = db.execute(
        select(Comment, Course).join(Lesson, Lesson.id == Comment.lesson_id).join(Stage, Stage.id == Lesson.stage_id)
        .join(Course, Course.id == Stage.course_id).where(Comment.id == comment_id)
        .options(selectinload(Comment.user))
    ).first()
    if row is None or not can_view(row.Course, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")
    return row.Comment, row.Course


@router.patch("/comments/{comment_id}/", response_model=CommentOut)
def edit_comment(comment_id: int, body: CommentEditIn, db: Db, user: CurrentUser, _limit: Annotated[None, POSTS]):
    comment, course = _comment_with_course(db, comment_id, user)
    if comment.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You can only edit your own comments.")
    comment.body = body.body
    comment.edited_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(comment)
    return _comment_out(comment, course, user)


@router.delete("/comments/{comment_id}/", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(comment_id: int, db: Db, user: CurrentUser):
    """By its writer, the course's author, or a moderator. Its replies go with it."""
    comment, course = _comment_with_course(db, comment_id, user)
    if comment.user_id != user.id and course.author_id != user.id and not is_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You can't delete this comment.")
    db.delete(comment)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- reports and moderation ----------------------------------------------------------------------------------------

TargetType = Literal["course", "review", "comment"]


class ReportIn(BaseModel):
    target_type: TargetType
    target_id: int
    reason: Literal["spam", "abuse", "inappropriate", "copyright", "misleading", "other"]
    details: Annotated[str, optional_text(1000)] = ""


def _target(db: Session, target_type: str, target_id: int):
    """The reported row, its writer's id, and the course it belongs to."""
    if target_type == "course":
        course = db.get(Course, target_id)
        return course, course.author_id if course else None, course
    if target_type == "review":
        review = db.get(Review, target_id)
        return review, review.user_id if review else None, db.get(Course, review.course_id) if review else None
    comment = db.get(Comment, target_id)
    if comment is None:
        return None, None, None
    course = db.scalar(select(Course).join(Stage).join(Lesson).where(Lesson.id == comment.lesson_id))
    return comment, comment.user_id, course


@router.post("/reports/", status_code=status.HTTP_204_NO_CONTENT)
def report(body: ReportIn, db: Db, user: CurrentUser, _limit: Annotated[None, POSTS]):
    target, owner_id, course = _target(db, body.target_type, body.target_id)
    if target is None or course is None or not can_view(course, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")
    if owner_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="You can't report your own content.")
    db.add(Report(reporter_id=user.id, target_type=body.target_type, target_id=body.target_id, reason=body.reason,
                  details=body.details))
    try:
        db.flush()
    except IntegrityError:
        db.rollback()  # reported already; saying so again changes nothing
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    open_reports = db.scalar(select(func.count()).where(
        Report.target_type == body.target_type, Report.target_id == body.target_id, Report.resolved_at.is_(None)
    ))
    if open_reports >= HIDE_AFTER_REPORTS:
        target.is_hidden = True
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def require_admin(user: CurrentUser) -> User:
    if not is_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Moderators only.")
    return user


Admin = Annotated[User, Depends(require_admin)]


class ReportedOut(BaseModel):
    target_type: TargetType
    target_id: int
    course_id: int | None
    preview: str  # the course title, review or comment text
    is_hidden: bool
    reports: int
    reasons: list[str]
    details: list[str]
    first_reported_at: datetime


@router.get("/moderation/reports/", response_model=list[ReportedOut])
def open_reports(db: Db, _admin: Admin):
    """Everything with open reports, most reported first."""
    groups = db.execute(
        select(Report.target_type, Report.target_id, func.count().label("count"),
               func.array_agg(Report.reason).label("reasons"), func.array_agg(Report.details).label("details"),
               func.min(Report.created_at).label("first"))
        .where(Report.resolved_at.is_(None)).group_by(Report.target_type, Report.target_id)
        .order_by(func.count().desc(), func.min(Report.created_at))
    ).all()
    out = []
    for group in groups:
        target, _owner, course = _target(db, group.target_type, group.target_id)
        if target is None:
            continue
        preview = target.title if group.target_type == "course" else (target.text if group.target_type == "review"
                                                                      else target.body)
        out.append(ReportedOut(
            target_type=group.target_type, target_id=group.target_id, course_id=course.id if course else None,
            preview=preview[:500], is_hidden=target.is_hidden, reports=group.count, reasons=sorted(set(group.reasons)),
            details=[detail for detail in group.details if detail], first_reported_at=group.first,
        ))
    return out


class DecisionIn(BaseModel):
    action: Literal["keep", "remove"]


@router.post("/moderation/{target_type}/{target_id}/", status_code=status.HTTP_204_NO_CONTENT)
def decide(target_type: TargetType, target_id: int, body: DecisionIn, db: Db, _admin: Admin):
    """keep: show it again and close its reports; remove: delete it for good."""
    target, _owner, _course = _target(db, target_type, target_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")
    images: list[str] = []
    if body.action == "keep":
        target.is_hidden = False
    else:
        if target_type == "course":
            images = [image.image for image in target.images]
        db.delete(target)
    for open_report in db.scalars(select(Report).where(
        Report.target_type == target_type, Report.target_id == target_id, Report.resolved_at.is_(None)
    )):
        open_report.resolved_at = datetime.now(timezone.utc)
    db.commit()
    delete_images(images)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
