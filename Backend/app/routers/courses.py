import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload
from starlette.datastructures import UploadFile as StarletteUploadFile

from app.auth import OptionalUser, Teacher
from app.db import get_db
from app.media import delete_images, media_url, read_images, save_images
from app.models import Course, CourseImage, Lesson, Stage
from app.schemas import (
    MAX_IMAGE_BYTES,
    MAX_IMAGES,
    AuthorOut,
    CourseDetailOut,
    CourseIn,
    CourseListItemOut,
    CoursePage,
    ImageOut,
    StageOut,
    StageShortOut,
)

router = APIRouter(prefix="/courses", tags=["courses"])

Db = Annotated[Session, Depends(get_db)]

# multipart bodies are refused before parsing when they can't possibly be valid
MAX_UPLOAD_BYTES = MAX_IMAGES * MAX_IMAGE_BYTES + 1024 * 1024


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


def to_detail(course: Course, request: Request) -> CourseDetailOut:
    stages = [StageOut.model_validate(stage) for stage in course.stages]
    return CourseDetailOut(**_course_fields(course, request), stages=stages)


async def parse_course_body(request: Request) -> tuple[CourseIn, list[UploadFile]]:
    """Accepts JSON, or multipart with `stages` as a JSON string plus `uploaded_images` files."""
    content_type = request.headers.get("content-type", "")
    files: list[UploadFile] = []

    if content_type.startswith("multipart/form-data"):
        if int(request.headers.get("content-length") or 0) > MAX_UPLOAD_BYTES:
            raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, detail="The upload is too large.")
        form = await request.form(max_files=MAX_IMAGES + 1, max_fields=20)
        stages = form.get("stages")
        try:
            stages = json.loads(stages) if isinstance(stages, str) else stages
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="stages: Invalid stages payload.")
        data = {"title": form.get("title"), "description": form.get("description"), "stages": stages}
        files = [item for item in form.getlist("uploaded_images") if isinstance(item, StarletteUploadFile)]
    elif content_type.startswith("application/json"):
        try:
            data = await request.json()
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="The request body isn't valid JSON.")
    else:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Send JSON or multipart/form-data.")

    try:
        return CourseIn.model_validate(data), files
    except ValidationError as exc:
        raise RequestValidationError(exc.errors(include_url=False)) from exc


@router.get("/", response_model=CoursePage)
def list_courses(
    request: Request,
    db: Db,
    user: OptionalUser,
    limit: Annotated[int, Query(ge=1, le=50)] = 5,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    query = select(Course)
    if user is not None and user.role == "teacher":
        # teachers manage their own courses here; everyone else browses the whole catalogue
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
    user: Teacher,  # declared before the body so unauthorized uploads are refused before parsing
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
                    lessons=[Lesson(title=lesson.title, url=lesson.url, order=lesson.order) for lesson in stage.lessons],
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
def course_detail(course_id: int, request: Request, db: Db, _user: OptionalUser):
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
    return to_detail(course, request)


@router.delete("/{course_id}/delete/", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, db: Db, user: Teacher):
    # someone else's course answers 404, not 403, so ids of other teachers' courses aren't confirmed
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
