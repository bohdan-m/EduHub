from datetime import datetime
from typing import Annotated
from urllib.parse import urlparse

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator
from pydantic_core import PydanticCustomError

# Keep in step with Frontend/src/utils/validation.ts
MAX_TITLE_LENGTH = 100
MAX_DESCRIPTION_LENGTH = 5000
MAX_URL_LENGTH = 200
MAX_IMAGES = 5
MAX_IMAGE_BYTES = 5 * 1024 * 1024
YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}


def required_text(max_length: int):
    def check(value: str) -> str:
        value = value.strip()
        if not value:
            raise PydanticCustomError("blank", "This field may not be blank.")
        if len(value) > max_length:
            raise PydanticCustomError("too_long", "Must be {max} characters or fewer.", {"max": max_length})
        return value

    return AfterValidator(check)


def youtube_url(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    parsed = urlparse(value)
    # the lesson player only embeds YouTube
    if parsed.scheme not in ("http", "https") or parsed.hostname not in YOUTUBE_HOSTS or len(value) > MAX_URL_LENGTH:
        raise PydanticCustomError("youtube_url", "Use a YouTube link.")
    return value


Title = Annotated[str, required_text(MAX_TITLE_LENGTH)]
Order = Annotated[int, Field(ge=0, le=100)]


def unique_orders(items: list, what: str) -> None:
    orders = [item.order for item in items]
    if len(orders) != len(set(orders)):
        raise PydanticCustomError("duplicate_order", "{what} orders must be unique.", {"what": what})


class LessonIn(BaseModel):
    title: Title
    url: Annotated[str, AfterValidator(youtube_url)] = ""
    order: Order


class StageIn(BaseModel):
    title: Title
    order: Order
    lessons: list[LessonIn]

    @model_validator(mode="after")
    def check_lessons(self):
        if not self.lessons:
            raise PydanticCustomError("no_lessons", "Every stage needs at least one lesson.")
        unique_orders(self.lessons, "Lesson")
        return self


class CourseIn(BaseModel):
    title: Title
    description: Annotated[str, required_text(MAX_DESCRIPTION_LENGTH)]
    stages: list[StageIn]

    @model_validator(mode="after")
    def check_stages(self):
        if not self.stages:
            raise PydanticCustomError("no_stages", "Add at least one stage.")
        unique_orders(self.stages, "Stage")
        return self


# Responses keep the JSON shape the frontend already uses


class AuthorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    role: str


class ImageOut(BaseModel):
    id: int
    image: str  # absolute URL


class StageShortOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    order: int


class LessonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    url: str
    order: int


class StageOut(StageShortOut):
    lessons: list[LessonOut]


class CourseOut(BaseModel):
    id: int
    title: str
    description: str
    created_at: datetime
    author: AuthorOut | None
    images: list[ImageOut]


class CourseListItemOut(CourseOut):
    stages: list[StageShortOut]


class CourseDetailOut(CourseOut):
    stages: list[StageOut]


class CoursePage(BaseModel):
    count: int
    next: str | None
    previous: str | None
    results: list[CourseListItemOut]
