import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import get_settings
from app.limits import BodySizeLimitMiddleware
from app.routers import courses, drafts

settings = get_settings()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("app.requests")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings.media_root.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="EduHub API",
    lifespan=lifespan,
    # interactive docs only outside production
    docs_url=None if settings.is_prod else "/api/docs",
    redoc_url=None,
    openapi_url=None if settings.is_prod else "/api/openapi.json",
)


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError):
    """400 with a readable `detail` ("title: This field may not be blank.") plus the full list in `errors`."""
    errors = [
        {"field": ".".join(str(part) for part in error["loc"] if part != "body"), "message": error["msg"]}
        for error in exc.errors()
    ]
    first = errors[0] if errors else {"field": "", "message": "Invalid request."}
    detail = f"{first['field']}: {first['message']}" if first["field"] else first["message"]
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": detail, "errors": errors})


@app.middleware("http")
async def security_headers_and_logging(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    if not request.url.path.startswith("/api/docs"):
        # JSON and images only: nothing here should ever run scripts or be framed
        response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
    if settings.is_prod:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    logger.info(
        "%s %s -> %s in %.1f ms",
        request.method,
        request.url.path,
        response.status_code,
        (time.perf_counter() - started) * 1000,
    )
    return response


app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts_list)
app.add_middleware(BodySizeLimitMiddleware)
# added last so it wraps everything, including error responses
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["authorization", "content-type"],
    max_age=86400,
)


@app.get("/", include_in_schema=False)
@app.get("/api/health/", tags=["health"])
def health():
    return {"status": "ok"}


app.include_router(courses.router, prefix="/api")
app.include_router(drafts.router, prefix="/api")
# course images: the demo set shipped in Backend/media and user uploads under media/course_previews
app.mount("/media", StaticFiles(directory=settings.media_root, check_dir=False), name="media")
