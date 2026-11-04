import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload
from starlette.datastructures import UploadFile as StarletteUploadFile

from app.auth import CurrentUser, OptionalUser
from app.db import get_db
from app.limits import MAX_CONTENT_BYTES, rate_limit
from app.media import delete_images, media_url, read_images, save_images
from app.models import Course, CourseImage, Lesson, Stage, User
from app.schemas import (
    MAX_IMAGES,
    AuthorOut,
    CourseDetailOut,
    CourseIn,
    CourseListItemOut,
    CoursePage,
    CourseUpdateIn,
    ImageOut,
    QuizAnswerIn,
    QuizResultOut,
    StageOut,
    StageShortOut,
)

router = APIRouter(prefix="/courses", tags=["courses"])

Db = Annotated[Session, Depends(get_db)]

# per user (or client address for guests) per minute; generous for people, tight for scripts
COURSE_WRITES = rate_limit("course-writes", limit=30)
QUIZ_CHECKS = rate_limit("quiz-checks", limit=120)


def _course_fields(course: Course, request: Request) -> dict:
    return {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "created_at": course.created_at,
        "author": AuthorOut.model_validate(course.author) if course.author else None,
        "images": [ImageOut(id=image.id, image=media_url(request, image.image)) for image in course.images],
    }


def to_list_item(course: Course, request: Request) -> CourseListItemOut:
    stages = [StageShortOut.model_validate(stage) for stage in course.stages]
    return CourseListItemOut(**_course_fields(course, request), stages=stages)


def public_block(block: dict) -> dict:
    """A block as learners get it: quizzes lose their answers and explanation, which only POST .../check/ reveals."""
    if block.get("type") != "quiz":
        return block
    options = block.get("options", [])
    return {
        "type": "quiz",
        "id": block["id"],
        "question": block["question"],
        "options": [{"id": option["id"], "text": option["text"]} for option in options],
        "multiple": sum(1 for option in options if option.get("correct")) > 1,
    }


def to_detail(course: Course, request: Request, user: User | None) -> CourseDetailOut:
    is_owner = user is not None and course.author_id == user.id
    stages = [StageOut.model_validate(stage) for stage in course.stages]
    if not is_owner:
        for stage in stages:
            for lesson in stage.lessons:
                lesson.blocks = [public_block(block) for block in lesson.blocks]
    return CourseDetailOut(**_course_fields(course, request), stages=stages, is_owner=is_owner)


def _json_field(value, name: str):
    try:
        return json.loads(value) if isinstance(value, str) else value
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"{name}: Invalid {name} payload.")


async def _read_course_body(request: Request, model: type[CourseIn]):
    """Accepts JSON, or multipart with `stages` (and `kept_images`) as JSON strings plus `uploaded_images` files."""
    content_type = request.headers.get("content-type", "")
    files: list[UploadFile] = []

    # body size is capped by BodySizeLimitMiddleware before this reads anything
    if content_type.startswith("multipart/form-data"):
        form = await request.form(max_files=MAX_IMAGES + 1, max_fields=20, max_part_size=MAX_CONTENT_BYTES)
        data = {"title": form.get("title"), "description": form.get("description"),
                "stages": _json_field(form.get("stages"), "stages")}
        if form.get("kept_images") is not None:
            data["kept_images"] = _json_field(form.get("kept_images"), "kept_images")
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


@router.get("/", response_model=CoursePage)
def list_courses(
    request: Request,
    db: Db,
    user: OptionalUser,
    limit: Annotated[int, Query(ge=1, le=50)] = 5,
    offset: Annotated[int, Query(ge=0)] = 0,
    mine: bool = False,
):
    query = select(Course)
    if mine:
        # the signed-in user's own courses; without it everyone browses the whole catalogue
        if user is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Sign in to see your courses.")
        query = query.where(Course.author_id == user.id)

    count = db.scalar(select(func.count()).select_from(query.subquery()))
    courses = db.scalars(
        query.options(selectinload(Course.author), selectinload(Course.images), selectinload(Course.stages))
        .order_by(Course.created_at.desc(), Course.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    next_url = str(request.url.include_query_params(limit=limit, offset=offset + limit)) if offset + limit < count else None
    previous_url = (
        str(request.url.include_query_params(limit=limit, offset=max(offset - limit, 0))) if offset > 0 else None
    )
    return CoursePage(
        count=count,
        next=next_url,
        previous=previous_url,
        results=[to_list_item(course, request) for course in courses],
    )


@router.post("/create/", response_model=CourseListItemOut, status_code=status.HTTP_201_CREATED)
def create_course(
    request: Request,
    db: Db,
    user: CurrentUser,  # declared before the body so unauthorized uploads are refused before parsing
    _limit: Annotated[None, COURSE_WRITES],
    body: Annotated[tuple[CourseIn, list[UploadFile]], Depends(parse_course_body)],
):
    payload, files = body
    saved = save_images(read_images(files))
    try:
        course = Course(
            title=payload.title,
            description=payload.description,
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
        db.add(course)
        db.commit()
    except Exception:
        db.rollback()
        delete_images(saved)
        raise
    db.refresh(course)
    return to_list_item(course, request)


@router.get("/{course_id}/", response_model=CourseDetailOut)
def course_detail(course_id: int, request: Request, db: Db, user: OptionalUser):
    course = db.scalar(
        select(Course)
        .where(Course.id == course_id)
        .options(
            selectinload(Course.author),
            selectinload(Course.images),
            selectinload(Course.stages).selectinload(Stage.lessons),
        )
    )
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")
    return to_detail(course, request, user)


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
    course = db.scalar(
        select(Course)
        .where(Course.id == course_id, Course.author_id == user.id)
        .options(selectinload(Course.images), selectinload(Course.stages).selectinload(Stage.lessons))
    )
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")

    kept_ids = set(payload.kept_images) if payload.kept_images is not None else {image.id for image in course.images}
    kept = [image for image in course.images if image.id in kept_ids]
    removed = [image.image for image in course.images if image.id not in kept_ids]
    if len(kept) + len(files) > MAX_IMAGES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"uploaded_images: Choose up to {MAX_IMAGES} images.")
    stages = _merge_stages(course, payload)

    saved = save_images(read_images(files))
    try:
        course.title = payload.title
        course.description = payload.description
        course.images = kept + [CourseImage(image=path) for path in saved]
        course.stages = stages
        db.commit()
    except Exception:
        db.rollback()
        delete_images(saved)
        raise
    delete_images(removed)  # only once the database no longer points at them
    db.refresh(course)
    return to_detail(course, request, user)


def _blocks(lesson) -> list[dict]:
    return [block.model_dump() for block in lesson.blocks]


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


@router.delete("/{course_id}/delete/", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, db: Db, user: CurrentUser, _limit: Annotated[None, COURSE_WRITES]):
    # someone else's course answers 404, not 403, so ids of other people's courses aren't confirmed
    course = db.scalar(
        select(Course).where(Course.id == course_id, Course.author_id == user.id).options(selectinload(Course.images))
    )
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")
    image_paths = [image.image for image in course.images]
    db.delete(course)
    db.commit()
    delete_images(image_paths)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{course_id}/lessons/{lesson_id}/quizzes/{block_id}/check/", response_model=QuizResultOut)
def check_quiz(course_id: int, lesson_id: int, block_id: str, answer: QuizAnswerIn, db: Db,
               _limit: Annotated[None, QUIZ_CHECKS]):
    """Grades an answer on the server: learners never receive the correct options before answering."""
    lesson = db.scalar(
        select(Lesson).join(Stage).where(Lesson.id == lesson_id, Stage.course_id == course_id)
    )
    quiz = next((b for b in lesson.blocks if b.get("type") == "quiz" and b.get("id") == block_id), None) if lesson else None
    if quiz is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")
    correct_ids = [option["id"] for option in quiz["options"] if option.get("correct")]
    return QuizResultOut(
        correct=set(answer.selected) == set(correct_ids),
        correct_option_ids=correct_ids,
        explanation=quiz.get("explanation", ""),
    )
