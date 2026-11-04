import uuid
from datetime import datetime
from typing import Annotated, Literal
from urllib.parse import urlparse

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator
from pydantic_core import PydanticCustomError

# Keep in step with Frontend/src/utils/validation.ts
MAX_TITLE_LENGTH = 100
MAX_DESCRIPTION_LENGTH = 5000
MAX_URL_LENGTH = 200
MAX_IMAGES = 5
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_BLOCKS = 50
MAX_TEXT_LENGTH = 20000
MAX_LINK_URL_LENGTH = 2000
MAX_QUIZ_OPTIONS = 8
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


def optional_text(max_length: int):
    def check(value: str) -> str:
        value = value.strip()
        if len(value) > max_length:
            raise PydanticCustomError("too_long", "Must be {max} characters or fewer.", {"max": max_length})
        return value

    return AfterValidator(check)


def required_youtube_url(value: str) -> str:
    if not value.strip():
        raise PydanticCustomError("blank", "Add a YouTube link.")
    return youtube_url(value)


def web_url(value: str) -> str:
    value = value.strip()
    parsed = urlparse(value)
    # only http(s): a javascript: or data: link would run in the learner's browser
    if parsed.scheme not in ("http", "https") or not parsed.hostname or len(value) > MAX_LINK_URL_LENGTH:
        raise PydanticCustomError("web_url", "Use a full web address starting with https://.")
    return value


Title = Annotated[str, required_text(MAX_TITLE_LENGTH)]
Order = Annotated[int, Field(ge=0, le=100)]
# Client-made ids let the editor, and later the AI, address one block or quiz option; new ones are generated
BlockId = Annotated[str, Field(pattern=r"^[A-Za-z0-9_-]{1,40}$", default_factory=lambda: uuid.uuid4().hex)]
# Existing stage/lesson ids keep their rows (and links to them) when a course is edited; leave out for new ones
RowId = Annotated[int | None, Field(default=None, ge=1)]


class TextBlock(BaseModel):
    """Markdown text. The frontend renders it without raw HTML."""

    type: Literal["text"]
    id: BlockId
    text: Annotated[str, required_text(MAX_TEXT_LENGTH)]


class VideoBlock(BaseModel):
    type: Literal["video"]
    id: BlockId
    url: Annotated[str, AfterValidator(required_youtube_url)]
    caption: Annotated[str, optional_text(200)] = ""


class LinkBlock(BaseModel):
    type: Literal["link"]
    id: BlockId
    url: Annotated[str, AfterValidator(web_url)]
    title: Annotated[str, required_text(200)]
    description: Annotated[str, optional_text(500)] = ""


class CalloutBlock(BaseModel):
    type: Literal["callout"]
    id: BlockId
    tone: Literal["info", "tip", "warning"] = "info"
    text: Annotated[str, required_text(2000)]


class QuizOption(BaseModel):
    id: BlockId
    text: Annotated[str, required_text(200)]
    correct: bool = False


class QuizBlock(BaseModel):
    """One question; several correct options make it "select all that apply"."""

    type: Literal["quiz"]
    id: BlockId
    question: Annotated[str, required_text(500)]
    options: list[QuizOption]
    explanation: Annotated[str, optional_text(1000)] = ""

    @model_validator(mode="after")
    def check_options(self):
        if not 2 <= len(self.options) <= MAX_QUIZ_OPTIONS:
            raise PydanticCustomError("quiz_options", "A quiz needs 2 to {max} answers.", {"max": MAX_QUIZ_OPTIONS})
        if not any(option.correct for option in self.options):
            raise PydanticCustomError("quiz_correct", "Mark at least one answer as correct.")
        unique_ids(self.options, "Answer")
        return self


Block = Annotated[TextBlock | VideoBlock | LinkBlock | CalloutBlock | QuizBlock, Field(discriminator="type")]


def unique_ids(items: list, what: str) -> None:
    ids = [item.id for item in items if item.id is not None]
    if len(ids) != len(set(ids)):
        raise PydanticCustomError("duplicate_id", "{what} ids must be unique.", {"what": what})


def unique_orders(items: list, what: str) -> None:
    orders = [item.order for item in items]
    if len(orders) != len(set(orders)):
        raise PydanticCustomError("duplicate_order", "{what} orders must be unique.", {"what": what})


class LessonIn(BaseModel):
    id: RowId
    title: Title
    order: Order
    # empty is allowed: an outline can come first and its lessons get written later
    blocks: list[Block] = Field(default_factory=list, max_length=MAX_BLOCKS)

    @model_validator(mode="after")
    def check_blocks(self):
        unique_ids(self.blocks, "Block")
        return self


class StageIn(BaseModel):
    id: RowId
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
        unique_ids(self.stages, "Stage")
        unique_ids([lesson for stage in self.stages for lesson in stage.lessons], "Lesson")
        return self


class CourseUpdateIn(CourseIn):
    # ids of the current images to keep; the rest are removed. Left out, every current image stays.
    kept_images: list[int] | None = None


# Responses keep the JSON shape the frontend already uses


class AuthorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


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
    order: int
    # stored blocks (validated as Block on the way in); for anyone but the author, quizzes come without answers
    blocks: list[dict]


class QuizAnswerIn(BaseModel):
    selected: list[Annotated[str, Field(max_length=40)]] = Field(max_length=MAX_QUIZ_OPTIONS)


class QuizResultOut(BaseModel):
    correct: bool
    correct_option_ids: list[str]
    explanation: str


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
    is_owner: bool = False


class CoursePage(BaseModel):
    count: int
    next: str | None
    previous: str | None
    results: list[CourseListItemOut]
