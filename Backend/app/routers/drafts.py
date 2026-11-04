from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.auth import CurrentUser
from app.db import get_db
from app.limits import rate_limit
from app.models import Course, CourseDraft, User

router = APIRouter(prefix="/drafts", tags=["drafts"])

Db = Annotated[Session, Depends(get_db)]
# the builder autosaves a second or two after typing stops, so this allows steady work but not a flood
DRAFT_SAVES = rate_limit("draft-saves", limit=60)


class DraftIn(BaseModel):
    course_id: int | None = None
    # the builder's working copy, kept as-is: a draft may be half-finished (the body size cap bounds it)
    data: dict = Field(min_length=1)


class DraftOut(BaseModel):
    course_id: int | None
    data: dict
    updated_at: datetime


def _check_course(db: Session, user: User, course_id: int | None) -> None:
    # a draft for an existing course belongs to its author; anyone else gets the same 404 as a missing course
    owned = select(Course.id).where(Course.id == course_id, Course.author_id == user.id)
    if course_id is not None and db.scalar(owned) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found.")


def _where(user: User, course_id: int | None):
    return (CourseDraft.user_id == user.id,
            CourseDraft.course_id.is_(None) if course_id is None else CourseDraft.course_id == course_id)


@router.get("/", response_model=DraftOut)
def get_draft(db: Db, user: CurrentUser, course_id: int | None = None):
    draft = db.scalar(select(CourseDraft).where(*_where(user, course_id)))
    if draft is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No draft.")
    return DraftOut(course_id=draft.course_id, data=draft.data, updated_at=draft.updated_at)


@router.put("/", response_model=DraftOut)
def save_draft(draft: DraftIn, db: Db, user: CurrentUser, _limit: Annotated[None, DRAFT_SAVES]):
    _check_course(db, user, draft.course_id)
    statement = insert(CourseDraft).values(user_id=user.id, course_id=draft.course_id, data=draft.data)
    saved = db.execute(
        statement.on_conflict_do_update(
            constraint="course_drafts_user_course_unique",
            set_={"data": statement.excluded.data, "updated_at": statement.excluded.updated_at},
        ).returning(CourseDraft.course_id, CourseDraft.data, CourseDraft.updated_at)
    ).one()
    db.commit()
    return DraftOut(course_id=saved.course_id, data=saved.data, updated_at=saved.updated_at)


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
def delete_draft(db: Db, user: CurrentUser, course_id: int | None = None):
    draft = db.scalar(select(CourseDraft).where(*_where(user, course_id)))
    if draft is not None:
        db.delete(draft)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
