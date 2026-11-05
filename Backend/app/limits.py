"""Request body size caps and per-user rate limits.

Both live in the app, not only in a proxy, so they hold in every deployment. A proxy limit is still welcome in front.
"""
import json
import time
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth import OptionalUser
from app.db import get_db
from app.schemas import MAX_IMAGE_BYTES, MAX_IMAGES

MAX_CONTENT_BYTES = 5 * 1024 * 1024  # a course or draft as JSON: stages, lessons and blocks, with room to spare
MAX_UPLOAD_BYTES = MAX_IMAGES * MAX_IMAGE_BYTES + MAX_CONTENT_BYTES


class BodySizeLimitMiddleware:
    """Refuses bodies over the cap with 413. Counts the bytes as they arrive, so a chunked body without a
    Content-Length (or with a false one) can't get past it."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in ("POST", "PUT", "PATCH"):
            return await self.app(scope, receive, send)

        headers = dict(scope["headers"])
        is_multipart = headers.get(b"content-type", b"").startswith(b"multipart/form-data")
        limit = MAX_UPLOAD_BYTES if is_multipart else MAX_CONTENT_BYTES
        declared = headers.get(b"content-length")
        if declared and declared.isdigit() and int(declared) > limit:
            return await _send_413(send)

        received = 0
        over = False
        replaced = False

        # Past the cap the body is cut short (the app then fails to parse it) and whatever the app answers is
        # swapped for a 413. Raising instead wouldn't work: FastAPI turns any error while reading a body into a 400.
        async def counted_receive():
            nonlocal received, over
            if over:
                return {"type": "http.request", "body": b"", "more_body": False}
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    over = True
                    return {"type": "http.request", "body": b"", "more_body": False}
            return message

        async def guarded_send(message):
            nonlocal replaced
            if not over:
                return await send(message)
            if not replaced:
                replaced = True
                await _send_413(send)

        await self.app(scope, counted_receive, guarded_send)


async def _send_413(send):
    body = json.dumps({"detail": "The request is too large."}).encode()
    await send({"type": "http.response.start", "status": 413,
                "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
    await send({"type": "http.response.body", "body": body})


def rate_limit(bucket: str, limit: int, period: int = 60):
    """A dependency allowing `limit` requests per `period` seconds per signed-in user (per client address for
    guests). Counted in Postgres, so the limit holds across every API worker and container."""

    def check(request: Request, user: OptionalUser, db: Annotated[Session, Depends(get_db)]) -> None:
        # shortcut: guests are keyed by the address the API sees; behind a proxy, run uvicorn with --proxy-headers
        who = f"user:{user.id}" if user else f"ip:{request.client.host if request.client else 'unknown'}"
        now = int(time.time())
        window = now - now % period
        hits = db.execute(
            text("""
                INSERT INTO rate_limits (key, window_start, hits) VALUES (:key, :window, 1)
                ON CONFLICT (key, window_start) DO UPDATE SET hits = rate_limits.hits + 1
                RETURNING hits
            """),
            {"key": f"{bucket}:{who}", "window": window},
        ).scalar_one()
        if hits == 1:
            # the first hit of a window tidies up windows that ended long ago
            db.execute(text("DELETE FROM rate_limits WHERE window_start < :old"), {"old": now - 3600})
        db.commit()
        if hits > limit:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Wait a moment and try again.",
                headers={"Retry-After": str(window + period - now)},
            )

    return Depends(check)
