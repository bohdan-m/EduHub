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
MAX_FILE_BYTES = 20 * 1024 * 1024
MAX_BLOCKS = 50
MAX_TEXT_LENGTH = 20000
MAX_LINK_URL_LENGTH = 2000
MAX_QUIZ_OPTIONS = 8
MAX_LIST_ITEMS = 10
YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
VIMEO_HOSTS = {"vimeo.com", "www.vimeo.com", "player.vimeo.com"}

CourseStatus = Literal["draft", "published", "unlisted"]
CourseLevel = Literal["all", "beginner", "intermediate", "advanced"]
CourseCategory = Literal[
    "programming", "data", "design", "business", "marketing", "languages", "science", "personal", "other"
]
CourseLanguage = Literal["en", "uk", "de", "fr", "es", "pl", "other"]


def required_text(max_length: int):
    def check(value: str) -> str:
        value = value.strip()
        if not value:
            raise PydanticCustomError("blank", "This field may not be blank.")
        if len(value) > max_length:
            raise PydanticCustomError("too_long", "Must be {max} characters or fewer.", {"max": max_length})
        return value

    return AfterValidator(check)


def optional_text(max_length: int):
    def check(value: str) -> str:
        value = value.strip()
        if len(value) > max_length:
            raise PydanticCustomError("too_long", "Must be {max} characters or fewer.", {"max": max_length})
        return value

    return AfterValidator(check)


def video_url(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    parsed = urlparse(value)
    # the lesson player only embeds YouTube and Vimeo
    hosts = YOUTUBE_HOSTS | VIMEO_HOSTS
    if parsed.scheme not in ("http", "https") or parsed.hostname not in hosts or len(value) > MAX_URL_LENGTH:
        raise PydanticCustomError("video_url", "Use a YouTube or Vimeo link.")
    return value


def required_video_url(value: str) -> str:
    if not value.strip():
        raise PydanticCustomError("blank", "Add a YouTube or Vimeo link.")
    return video_url(value)


def web_url(value: str) -> str:
    value = value.strip()
    parsed = urlparse(value)
    # only http(s): a javascript: or data: link would run in the learner's browser
    if parsed.scheme not in ("http", "https") or not parsed.hostname or len(value) > MAX_LINK_URL_LENGTH:
        raise PydanticCustomError("web_url", "Use a full web address starting with https://.")
    return value


def text_list(max_length: int):
    """Short bullet lists ("what you'll learn"): blanks dropped, each item and the count capped."""

    def check(items: list[str]) -> list[str]:
        cleaned = [item.strip() for item in items if item.strip()]
        if len(cleaned) > MAX_LIST_ITEMS:
            raise PydanticCustomError("too_many", "Add up to {max} items.", {"max": MAX_LIST_ITEMS})
        if any(len(item) > max_length for item in cleaned):
            raise PydanticCustomError("too_long", "Each item must be {max} characters or fewer.", {"max": max_length})
        return cleaned

    return AfterValidator(check)


Title = Annotated[str, required_text(MAX_TITLE_LENGTH)]
Order = Annotated[int, Field(ge=0, le=100)]
# Client-made ids let the editor, and later the AI, address one block or quiz option; new ones are generated
BlockId = Annotated[str, Field(pattern=r"^[A-Za-z0-9_-]{1,40}$", default_factory=lambda: uuid.uuid4().hex)]
# Existing stage/lesson ids keep their rows (and links to them) when a course is edited; leave out for new ones
RowId = Annotated[int | None, Field(default=None, ge=1)]
# a file from POST /api/uploads/, stored relative to MEDIA_ROOT; the API checks the author uploaded it
UploadPath = Annotated[str, Field(pattern=r"^lesson_uploads/[0-9a-f]{32}\.[a-z0-9]{2,5}$")]


class TextBlock(BaseModel):
    """Markdown text. The frontend renders it without raw HTML."""

    type: Literal["text"]
    id: BlockId
    text: Annotated[str, required_text(MAX_TEXT_LENGTH)]


class VideoBlock(BaseModel):
    type: Literal["video"]
    id: BlockId
    url: Annotated[str, AfterValidator(required_video_url)]
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


class ImageBlock(BaseModel):
    type: Literal["image"]
    id: BlockId
    path: UploadPath
    alt: Annotated[str, required_text(200)]  # read aloud by screen readers
    caption: Annotated[str, optional_text(200)] = ""


class FileBlock(BaseModel):
    """A download: slides, a worksheet, starter code."""

    type: Literal["file"]
    id: BlockId
    path: UploadPath
    name: Annotated[str, required_text(200)]
    size: Annotated[int, Field(ge=0, le=MAX_FILE_BYTES)] = 0
    description: Annotated[str, optional_text(300)] = ""


class QuizOption(BaseModel):
    id: BlockId
    text: Annotated[str, required_text(200)]
    correct: bool = False


class MatchPair(BaseModel):
    id: BlockId
    left: Annotated[str, required_text(200)]
    right: Annotated[str, required_text(200)]


class QuizBlock(BaseModel):
    """One question. `choice`: pick options (several correct makes it "select all that apply"; two options make a
    true/false); `short`: type an answer, any of `answers` counts, case and spacing ignored; `match`: pair each
    left item with its right item."""

    type: Literal["quiz"]
    id: BlockId
    kind: Literal["choice", "short", "match"] = "choice"
    question: Annotated[str, required_text(500)]
    options: list[QuizOption] = Field(default_factory=list)
    answers: list[Annotated[str, required_text(200)]] = Field(default_factory=list)
    pairs: list[MatchPair] = Field(default_factory=list)
    explanation: Annotated[str, optional_text(1000)] = ""

    @model_validator(mode="after")
    def check_kind(self):
        if self.kind == "choice":
            if not 2 <= len(self.options) <= MAX_QUIZ_OPTIONS:
                raise PydanticCustomError("quiz_options", "A quiz needs 2 to {max} answers.", {"max": MAX_QUIZ_OPTIONS})
            if not any(option.correct for option in self.options):
                raise PydanticCustomError("quiz_correct", "Mark at least one answer as correct.")
            unique_ids(self.options, "Answer")
            self.answers, self.pairs = [], []
        elif self.kind == "short":
            if not 1 <= len(self.answers) <= MAX_QUIZ_OPTIONS:
                raise PydanticCustomError("quiz_answers", "Add 1 to {max} accepted answers.", {"max": MAX_QUIZ_OPTIONS})
            self.options, self.pairs = [], []
        else:
            if not 2 <= len(self.pairs) <= MAX_QUIZ_OPTIONS:
                raise PydanticCustomError("quiz_pairs", "A matching quiz needs 2 to {max} pairs.", {"max": MAX_QUIZ_OPTIONS})
            unique_ids(self.pairs, "Pair")
            if len({pair.right.casefold() for pair in self.pairs}) != len(self.pairs):
                raise PydanticCustomError("quiz_pairs", "Each pair needs a different right-hand side.")
            self.options, self.answers = [], []
        return self


Block = Annotated[
    TextBlock | VideoBlock | LinkBlock | CalloutBlock | ImageBlock | FileBlock | QuizBlock,
    Field(discriminator="type"),
]


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
    status: CourseStatus = "draft"
    category: CourseCategory = "other"
    level: CourseLevel = "all"
    language: CourseLanguage = "en"
    outcomes: Annotated[list[str], text_list(160)] = Field(default_factory=list)
    requirements: Annotated[list[str], text_list(160)] = Field(default_factory=list)
    intro_video_url: Annotated[str, AfterValidator(video_url)] = ""

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


class CourseStatusIn(BaseModel):
    status: CourseStatus


# Responses keep the JSON shape the frontend already uses


class AuthorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    headline: str = ""


class AuthorDetailOut(AuthorOut):
    bio: str = ""


class ImageOut(BaseModel):
    id: int
    image: str  # absolute URL
    thumbnail: str  # a smaller copy for cards; the image itself when there is none


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
    selected: list[Annotated[str, Field(max_length=40)]] = Field(default_factory=list, max_length=MAX_QUIZ_OPTIONS)
    text: Annotated[str, Field(max_length=200)] = ""
    # matching quizzes: left pair id -> the right-hand text picked for it
    matches: dict[Annotated[str, Field(max_length=40)], Annotated[str, Field(max_length=200)]] = Field(
        default_factory=dict, max_length=MAX_QUIZ_OPTIONS
    )


class QuizResultOut(BaseModel):
    correct: bool
    correct_option_ids: list[str] = Field(default_factory=list)
    accepted_answers: list[str] = Field(default_factory=list)
    correct_matches: dict[str, str] = Field(default_factory=dict)
    explanation: str


class StageOut(StageShortOut):
    lessons: list[LessonOut]


class RatingOut(BaseModel):
    average: float | None
    count: int


class CourseOut(BaseModel):
    id: int
    title: str
    description: str
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None
    status: CourseStatus
    category: str
    level: str
    language: str
    lesson_count: int
    estimated_minutes: int
    author: AuthorOut | None
    images: list[ImageOut]
    rating: RatingOut
    learner_count: int


class CourseListItemOut(CourseOut):
    stages: list[StageShortOut]


class EnrollmentOut(BaseModel):
    enrolled_at: datetime
    last_lesson_id: int | None
    completed_at: datetime | None
    certificate_code: str | None
    completed_lesson_ids: list[int]
    bookmarked_lesson_ids: list[int]
    # quizzes answered: block id -> whether the latest try was right
    quiz_results: dict[str, bool]


class CourseDetailOut(CourseOut):
    stages: list[StageOut]
    author: AuthorDetailOut | None
    outcomes: list[str]
    requirements: list[str]
    intro_video_url: str
    is_owner: bool = False
    is_hidden: bool = False
    enrollment: EnrollmentOut | None = None
    my_review_id: int | None = None


class CoursePage(BaseModel):
    count: int
    next: str | None
    previous: str | None
    results: list[CourseListItemOut]
