import json
import shutil
import uuid
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, selectinload
from starlette.datastructures import UploadFile as StarletteUploadFile

from app.auth import CurrentUser, OptionalUser
from app.config import get_settings
from app.content import course_totals, grade, present_block, upload_paths
from app.db import get_db
from app.limits import MAX_CONTENT_BYTES, rate_limit
from app.media import UPLOAD_DIR, delete_images, media_url, read_images, save_images, thumbnail_path
from app.models import (
    Course,
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
from app.schemas import (
    MAX_IMAGES,
    AuthorDetailOut,
    AuthorOut,
    CourseCategory,
    CourseDetailOut,
    CourseIn,
    CourseLevel,
    CourseListItemOut,
    CoursePage,
    CourseStatusIn,
    CourseUpdateIn,
    EnrollmentOut,
    ImageOut,
    QuizAnswerIn,
    QuizResultOut,
    RatingOut,
    StageOut,
    StageShortOut,
)

router = APIRouter(prefix="/courses", tags=["courses"])

Db = Annotated[Session, Depends(get_db)]

# per user (or client address for guests) per minute; generous for people, tight for scripts
COURSE_WRITES = rate_limit("course-writes", limit=30)
QUIZ_CHECKS = rate_limit("quiz-checks", limit=120)


# --- who sees what -------------------------------------------------------------------------------------------------


def can_view(course: Course, user: User | None) -> bool:
    """Authors always see their own courses; everyone else sees published and unlisted ones nobody has had hidden."""
    if user is not None and course.author_id == user.id:
        return True
    return course.status != "draft" and not course.is_hidden


def visible_course(db: Session, course_id: int, user: User | None, *options) -> Course:
    course = db.scalar(select(Course).where(Course.id == course_id).options(*options))
    # a draft or hidden course answers like a missing one, so its existence isn't confirmed
    if course is None or not can_view(course, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")
    return course


def owned_course(db: Session, course_id: int, user: User, *options) -> Course:
    # someone else's course answers 404, not 403, so ids of other people's courses aren't confirmed
    course = db.scalar(select(Course).where(Course.id == course_id, Course.author_id == user.id).options(*options))
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")
    return course


def catalogue_filter():
    return (Course.status == "published", Course.is_hidden.is_(False))


# --- presenting ----------------------------------------------------------------------------------------------------


def course_stats(db: Session, course_ids: list[int]) -> dict[int, tuple[RatingOut, int]]:
    """Rating and learner count per course, in two queries for any number of courses."""
    if not course_ids:
        return {}
    ratings = {
        row.course_id: RatingOut(average=round(float(row.average), 2), count=row.count)
        for row in db.execute(
            select(Review.course_id, func.avg(Review.rating).label("average"), func.count().label("count"))
            .where(Review.course_id.in_(course_ids), Review.is_hidden.is_(False))
            .group_by(Review.course_id)
        )
    }
    learners = dict(
        db.execute(
            select(Enrollment.course_id, func.count())
            .where(Enrollment.course_id.in_(course_ids))
            .group_by(Enrollment.course_id)
        ).all()
    )
    empty = RatingOut(average=None, count=0)
    return {course_id: (ratings.get(course_id, empty), learners.get(course_id, 0)) for course_id in course_ids}


def image_out(request: Request, image: CourseImage) -> ImageOut:
    return ImageOut(
        id=image.id, image=media_url(request, image.image), thumbnail=media_url(request, thumbnail_path(image.image))
    )


def _course_fields(course: Course, request: Request, stats: tuple[RatingOut, int]) -> dict:
    rating, learners = stats
    return {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "created_at": course.created_at,
        "updated_at": course.updated_at,
        "published_at": course.published_at,
        "status": course.status,
        "category": course.category,
        "level": course.level,
        "language": course.language,
        "lesson_count": course.lesson_count,
        "estimated_minutes": course.estimated_minutes,
        "author": AuthorOut.model_validate(course.author) if course.author else None,
        "images": [image_out(request, image) for image in course.images],
        "rating": rating,
        "learner_count": learners,
    }


def to_list_items(db: Session, courses: list[Course], request: Request) -> list[CourseListItemOut]:
    stats = course_stats(db, [course.id for course in courses])
    return [
        CourseListItemOut(
            **_course_fields(course, request, stats[course.id]),
            stages=[StageShortOut.model_validate(stage) for stage in course.stages],
        )
        for course in courses
    ]


def list_options():
    return (selectinload(Course.author), selectinload(Course.images), selectinload(Course.stages))


def detail_options():
    return (
        selectinload(Course.author),
        selectinload(Course.images),
        selectinload(Course.stages).selectinload(Stage.lessons),
    )


def enrollment_out(db: Session, enrollment: Enrollment, course: Course) -> EnrollmentOut:
    lesson_ids = [lesson.id for stage in course.stages for lesson in stage.lessons]
    progress = db.scalars(
        select(LessonProgress).where(LessonProgress.user_id == enrollment.user_id, LessonProgress.lesson_id.in_(lesson_ids))
    ).all()
    attempts = db.execute(
        select(QuizAttempt.block_id, QuizAttempt.correct)
        .where(QuizAttempt.user_id == enrollment.user_id, QuizAttempt.lesson_id.in_(lesson_ids))
    ).all()
    return EnrollmentOut(
        enrolled_at=enrollment.enrolled_at,
        last_lesson_id=enrollment.last_lesson_id,
        completed_at=enrollment.completed_at,
        certificate_code=enrollment.certificate_code,
        completed_lesson_ids=[p.lesson_id for p in progress if p.completed_at is not None],
        bookmarked_lesson_ids=[p.lesson_id for p in progress if p.bookmarked],
        quiz_results={row.block_id: row.correct for row in attempts},
    )


def to_detail(db: Session, course: Course, request: Request, user: User | None) -> CourseDetailOut:
    is_owner = user is not None and course.author_id == user.id
    stages = [StageOut.model_validate(stage) for stage in course.stages]
    for stage in stages:
        for lesson in stage.lessons:
            lesson.blocks = [present_block(block, request, full=is_owner) for block in lesson.blocks]

    enrollment = my_review_id = None
    if user is not None and not is_owner:
        record = db.scalar(select(Enrollment).where(Enrollment.user_id == user.id, Enrollment.course_id == course.id))
        enrollment = enrollment_out(db, record, course) if record else None
        my_review_id = db.scalar(select(Review.id).where(Review.user_id == user.id, Review.course_id == course.id))

    fields = _course_fields(course, request, course_stats(db, [course.id])[course.id])
    fields["author"] = AuthorDetailOut.model_validate(course.author) if course.author else None
    return CourseDetailOut(
        **fields,
        stages=stages,
        outcomes=course.outcomes,
        requirements=course.requirements,
        intro_video_url=course.intro_video_url,
        is_owner=is_owner,
        is_hidden=course.is_hidden,
        enrollment=enrollment,
        my_review_id=my_review_id,
    )


# --- reading the body ----------------------------------------------------------------------------------------------


def _json_field(value, name: str):
    try:
        return json.loads(value) if isinstance(value, str) else value
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"{name}: Invalid {name} payload.")


JSON_FORM_FIELDS = ("stages", "kept_images", "outcomes", "requirements")
TEXT_FORM_FIELDS = ("title", "description", "status", "category", "level", "language", "intro_video_url")


async def _read_course_body(request: Request, model: type[CourseIn]):
    """Accepts JSON, or multipart with list fields (`stages`, `kept_images`, `outcomes`, `requirements`) as JSON
    strings plus `uploaded_images` files."""
    content_type = request.headers.get("content-type", "")
    files: list[UploadFile] = []

    # body size is capped by BodySizeLimitMiddleware before this reads anything
    if content_type.startswith("multipart/form-data"):
        form = await request.form(max_files=MAX_IMAGES + 1, max_fields=30, max_part_size=MAX_CONTENT_BYTES)
        data = {name: form.get(name) for name in TEXT_FORM_FIELDS if form.get(name) is not None}
        data.update({name: _json_field(form.get(name), name) for name in JSON_FORM_FIELDS if form.get(name) is not None})
        files = [item for item in form.getlist("uploaded_images") if isinstance(item, StarletteUploadFile)]
    elif content_type.startswith("application/json"):
        try:
            data = await request.json()
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="The request body isn't valid JSON.")
    else:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Send JSON or multipart/form-data.")

    try:
        return model.model_validate(data), files
    except ValidationError as exc:
        raise RequestValidationError(exc.errors(include_url=False)) from exc


async def parse_course_body(request: Request) -> tuple[CourseIn, list[UploadFile]]:
    return await _read_course_body(request, CourseIn)


async def parse_course_update(request: Request) -> tuple[CourseUpdateIn, list[UploadFile]]:
    return await _read_course_body(request, CourseUpdateIn)


def _blocks(lesson) -> list[dict]:
    return [block.model_dump() for block in lesson.blocks]


def _check_uploads(db: Session, user: User, payload: CourseIn) -> None:
    """Image and file blocks may only point at files their author uploaded."""
    paths = set().union(*(upload_paths(_blocks(lesson)) for stage in payload.stages for lesson in stage.lessons))
    if not paths:
        return
    owned = set(db.scalars(select(Upload.path).where(Upload.user_id == user.id, Upload.path.in_(paths))))
    if paths - owned:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="stages: A lesson refers to a file that isn't yours.")


def _check_publishable(status_value: str, lessons_blocks: list[list]) -> None:
    if status_value != "draft" and any(not blocks for blocks in lessons_blocks):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="status: Every lesson needs some content before the course goes live. Save it as a draft for now.",
        )


def _apply_details(course: Course, payload: CourseIn) -> None:
    course.title = payload.title
    course.description = payload.description
    if payload.status != "draft" and course.published_at is None:
        course.published_at = datetime.now(timezone.utc)
    course.status = payload.status
    course.category = payload.category
    course.level = payload.level
    course.language = payload.language
    course.outcomes = payload.outcomes
    course.requirements = payload.requirements
    course.intro_video_url = payload.intro_video_url
    course.lesson_count, course.estimated_minutes = course_totals(
        [_blocks(lesson) for stage in payload.stages for lesson in stage.lessons]
    )


# --- catalogue -----------------------------------------------------------------------------------------------------


@router.get("/", response_model=CoursePage)
def list_courses(
    request: Request,
    db: Db,
    user: OptionalUser,
    limit: Annotated[int, Query(ge=1, le=50)] = 12,
    offset: Annotated[int, Query(ge=0)] = 0,
    mine: bool = False,
    author: Annotated[int | None, Query(ge=1)] = None,
    q: Annotated[str, Query(max_length=100)] = "",
    category: CourseCategory | None = None,
    level: CourseLevel | None = None,
    sort: Literal["newest", "popular", "rating"] = "newest",
):
    query = select(Course)
    if mine:
        # the signed-in user's own courses in every state; without it everyone browses the published catalogue
        if user is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Sign in to see your courses.")
        query = query.where(Course.author_id == user.id)
    else:
        query = query.where(*catalogue_filter())
        if author is not None:
            query = query.where(Course.author_id == author)
    if q.strip():
        pattern = "%" + q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        query = query.where(or_(Course.title.ilike(pattern), Course.description.ilike(pattern)))
    if category:
        query = query.where(Course.category == category)
    if level:
        query = query.where(Course.level == level)

    count = db.scalar(select(func.count()).select_from(query.subquery()))
    if sort == "popular":
        learners = (
            select(Enrollment.course_id, func.count().label("n")).group_by(Enrollment.course_id).subquery()
        )
        query = query.outerjoin(learners, learners.c.course_id == Course.id).order_by(
            func.coalesce(learners.c.n, 0).desc()
        )
    elif sort == "rating":
        ratings = (
            select(Review.course_id, func.avg(Review.rating).label("avg"), func.count().label("n"))
            .where(Review.is_hidden.is_(False))
            .group_by(Review.course_id)
            .subquery()
        )
        query = query.outerjoin(ratings, ratings.c.course_id == Course.id).order_by(
            ratings.c.avg.desc().nulls_last(), func.coalesce(ratings.c.n, 0).desc()
        )
    courses = db.scalars(
        query.options(*list_options()).order_by(Course.created_at.desc(), Course.id.desc()).limit(limit).offset(offset)
    ).all()

    next_url = str(request.url.include_query_params(limit=limit, offset=offset + limit)) if offset + limit < count else None
    previous_url = (
        str(request.url.include_query_params(limit=limit, offset=max(offset - limit, 0))) if offset > 0 else None
    )
    return CoursePage(count=count, next=next_url, previous=previous_url, results=to_list_items(db, courses, request))


# --- one course ----------------------------------------------------------------------------------------------------


@router.post("/create/", response_model=CourseListItemOut, status_code=status.HTTP_201_CREATED)
def create_course(
    request: Request,
    db: Db,
    user: CurrentUser,  # declared before the body so unauthorized uploads are refused before parsing
    _limit: Annotated[None, COURSE_WRITES],
    body: Annotated[tuple[CourseIn, list[UploadFile]], Depends(parse_course_body)],
):
    payload, files = body
    _check_publishable(payload.status, [lesson.blocks for stage in payload.stages for lesson in stage.lessons])
    _check_uploads(db, user, payload)
    saved = save_images(read_images(files))
    try:
        course = Course(
            author=user,
            images=[CourseImage(image=path) for path in saved],
            stages=[
                Stage(
                    title=stage.title,
                    order=stage.order,
                    lessons=[
                        Lesson(title=lesson.title, order=lesson.order, blocks=_blocks(lesson)) for lesson in stage.lessons
                    ],
                )
                for stage in payload.stages
            ],
        )
        _apply_details(course, payload)
        db.add(course)
        db.commit()
    except Exception:
        db.rollback()
        delete_images(saved)
        raise
    db.refresh(course)
    return to_list_items(db, [course], request)[0]


@router.get("/{course_id}/", response_model=CourseDetailOut)
def course_detail(course_id: int, request: Request, db: Db, user: OptionalUser):
    return to_detail(db, visible_course(db, course_id, user, *detail_options()), request, user)


@router.put("/{course_id}/", response_model=CourseDetailOut)
def update_course(
    course_id: int,
    request: Request,
    db: Db,
    user: CurrentUser,  # before the body, so strangers' uploads are refused before parsing
    _limit: Annotated[None, COURSE_WRITES],
    body: Annotated[tuple[CourseUpdateIn, list[UploadFile]], Depends(parse_course_update)],
):
    """Replace a course's details and curriculum. Stages and lessons sent with their id keep it; the rest are new,
    and any not sent are deleted."""
    payload, files = body
    course = owned_course(
        db, course_id, user, selectinload(Course.images), selectinload(Course.stages).selectinload(Stage.lessons)
    )

    kept_ids = set(payload.kept_images) if payload.kept_images is not None else {image.id for image in course.images}
    kept = [image for image in course.images if image.id in kept_ids]
    removed = [image.image for image in course.images if image.id not in kept_ids]
    if len(kept) + len(files) > MAX_IMAGES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"uploaded_images: Choose up to {MAX_IMAGES} images.")
    _check_publishable(payload.status, [lesson.blocks for stage in payload.stages for lesson in stage.lessons])
    _check_uploads(db, user, payload)
    stages = _merge_stages(course, payload)

    saved = save_images(read_images(files))
    try:
        _apply_details(course, payload)
        course.images = kept + [CourseImage(image=path) for path in saved]
        course.stages = stages
        db.commit()
    except Exception:
        db.rollback()
        delete_images(saved)
        raise
    delete_images(removed)  # only once the database no longer points at them
    db.refresh(course)
    return to_detail(db, course, request, user)


@router.post("/{course_id}/status/", response_model=CourseDetailOut)
def set_status(course_id: int, body: CourseStatusIn, request: Request, db: Db, user: CurrentUser,
               _limit: Annotated[None, COURSE_WRITES]):
    """Publish, unlist or take a course back to draft without sending the whole course."""
    course = owned_course(db, course_id, user, *detail_options())
    _check_publishable(body.status, [lesson.blocks for stage in course.stages for lesson in stage.lessons])
    if body.status != "draft" and course.published_at is None:
        course.published_at = datetime.now(timezone.utc)
    course.status = body.status
    db.commit()
    db.refresh(course)
    return to_detail(db, course, request, user)


def _merge_stages(course: Course, payload: CourseUpdateIn) -> list[Stage]:
    stages_by_id = {stage.id: stage for stage in course.stages}
    lessons_by_id = {lesson.id: lesson for stage in course.stages for lesson in stage.lessons}
    merged = []
    for stage_in in payload.stages:
        stage = _existing(stages_by_id, stage_in.id, "Stage") or Stage()
        stage.title, stage.order = stage_in.title, stage_in.order
        lessons = []
        for lesson_in in stage_in.lessons:
            # a lesson may move to another stage of the same course; it keeps its id
            lesson = _existing(lessons_by_id, lesson_in.id, "Lesson") or Lesson()
            lesson.title, lesson.order, lesson.blocks = lesson_in.title, lesson_in.order, _blocks(lesson_in)
            lessons.append(lesson)
        stage.lessons = lessons
        merged.append(stage)
    return merged


def _existing(rows: dict, row_id: int | None, what: str):
    if row_id is None:
        return None
    if row_id not in rows:
        # an id from another course (or a deleted row) must never be adopted
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"stages: {what} {row_id} isn't part of this course.")
    return rows[row_id]


@router.post("/{course_id}/duplicate/", response_model=CourseListItemOut, status_code=status.HTTP_201_CREATED)
def duplicate_course(course_id: int, request: Request, db: Db, user: CurrentUser,
                     _limit: Annotated[None, COURSE_WRITES]):
    """A draft copy of one of your courses, with copies of its cover images; learners and reviews stay behind."""
    source = owned_course(db, course_id, user, *detail_options())
    root = get_settings().media_root
    copied: list[str] = []
    try:
        for image in source.images:
            if not image.image.startswith(f"{UPLOAD_DIR}/"):
                copied.append(image.image)  # a shipped demo image is shared, never deleted
                continue
            name = f"{UPLOAD_DIR}/{uuid.uuid4().hex}.webp"
            shutil.copyfile(root / image.image, root / name)
            if thumbnail_path(image.image) != image.image and (root / thumbnail_path(image.image)).exists():
                shutil.copyfile(root / thumbnail_path(image.image), root / thumbnail_path(name))
            copied.append(name)
        copy = Course(
            title=f"Copy of {source.title}"[:100],
            description=source.description,
            author=user,
            status="draft",
            category=source.category,
            level=source.level,
            language=source.language,
            outcomes=list(source.outcomes),
            requirements=list(source.requirements),
            intro_video_url=source.intro_video_url,
            lesson_count=source.lesson_count,
            estimated_minutes=source.estimated_minutes,
            images=[CourseImage(image=path) for path in copied],
            stages=[
                Stage(title=stage.title, order=stage.order, lessons=[
                    Lesson(title=lesson.title, order=lesson.order, blocks=list(lesson.blocks)) for lesson in stage.lessons
                ])
                for stage in source.stages
            ],
        )
        db.add(copy)
        db.commit()
    except Exception:
        db.rollback()
        delete_images(copied)
        raise
    db.refresh(copy)
    return to_list_items(db, [copy], request)[0]


@router.get("/{course_id}/related/", response_model=list[CourseListItemOut])
def related_courses(course_id: int, request: Request, db: Db, user: OptionalUser):
    """Up to four other published courses in the same category, the ones with most learners first."""
    course = visible_course(db, course_id, user)
    learners = select(Enrollment.course_id, func.count().label("n")).group_by(Enrollment.course_id).subquery()
    courses = db.scalars(
        select(Course)
        .where(*catalogue_filter(), Course.category == course.category, Course.id != course.id)
        .outerjoin(learners, learners.c.course_id == Course.id)
        .order_by(func.coalesce(learners.c.n, 0).desc(), Course.created_at.desc())
        .options(*list_options())
        .limit(4)
    ).all()
    return to_list_items(db, courses, request)


@router.delete("/{course_id}/delete/", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, db: Db, user: CurrentUser, _limit: Annotated[None, COURSE_WRITES]):
    course = owned_course(db, course_id, user, selectinload(Course.images))
    image_paths = [image.image for image in course.images]
    db.delete(course)
    db.commit()
    delete_images(image_paths)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{course_id}/lessons/{lesson_id}/quizzes/{block_id}/check/", response_model=QuizResultOut)
def check_quiz(course_id: int, lesson_id: int, block_id: str, answer: QuizAnswerIn, db: Db, user: OptionalUser,
               _limit: Annotated[None, QUIZ_CHECKS]):
    """Grades an answer on the server: learners never receive the correct answers before trying. Signed-in
    learners' results are kept, for their progress and the author's stats."""
    course = visible_course(db, course_id, user)
    lesson = db.scalar(select(Lesson).join(Stage).where(Lesson.id == lesson_id, Stage.course_id == course.id))
    quiz = next((b for b in lesson.blocks if b.get("type") == "quiz" and b.get("id") == block_id), None) if lesson else None
    if quiz is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")
    result = grade(quiz, answer)

    if user is not None and course.author_id != user.id:
        # one statement, so two quick clicks can't both count as the first try
        statement = insert(QuizAttempt).values(user_id=user.id, lesson_id=lesson_id, block_id=block_id, attempts=1,
                                               first_correct=result.correct, correct=result.correct)
        db.execute(statement.on_conflict_do_update(
            index_elements=["user_id", "lesson_id", "block_id"],
            set_={"attempts": QuizAttempt.attempts + 1, "correct": result.correct, "updated_at": func.now()},
        ))
        db.commit()
    return result
