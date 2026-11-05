# Backend context

This is EduHub's FastAPI API (Python 3.12, SQLAlchemy 2, Alembic, Pydantic 2). Follow the parent [context](../AI_CONTEXT.md) and [workflow](../AGENTS.md).

- `app/main.py`: app setup — trusted hosts, CORS, security headers, request logging, 400 handler for validation errors (`{"detail": "field: message", "errors": [...]}`), `/` and `/api/health/`, course routes under `/api`, uploaded media at `/media`. Interactive docs at `/api/docs` outside production.
- `app/config.py`: settings from env vars (POSTGRES_*, ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, BETTER_AUTH_URL, BETTER_AUTH_JWKS_URL, MEDIA_ROOT, ENVIRONMENT, ENABLE_POPULATE_DB).
- `app/auth.py`: verifies Better Auth JWTs (EdDSA only; issuer/audience = `BETTER_AUTH_URL`; keys from `BETTER_AUTH_JWKS_URL`, cached) and mirrors the user into `users` by `auth_id`. Dependencies: `OptionalUser` (guest allowed, bad token = 401), `CurrentUser` (401 for guests). There are no roles. There is no login/password code here; Better Auth (Next.js) owns accounts.
- `app/routers/courses.py`: catalogue (published and not hidden; `q`, `category`, `level`, `author`, `sort=newest|popular|rating`, limit/offset; `mine=true` = the caller's own in every state, 401 for guests), detail (drafts and hidden courses only for their author, 404 for others), create/edit (JSON or multipart), `status/`, `duplicate/`, `related/`, delete (author only, 404 otherwise), quiz `check/` (records signed-in learners' attempts). `can_view`/`visible_course`/`owned_course` decide access.
- `app/content.py`: estimated minutes, `present_block` (upload URLs; quiz answers stripped for non-authors) and `grade` for choice, short-answer and matching quizzes.
- `app/routers/learning.py`: enroll/leave, lesson progress (completed, bookmarked, note; finishing the last lesson issues `certificate_code`), `/me/learning/`, public `/certificates/{code}/`, the author's `/courses/{id}/stats/` and `/me/teaching/`.
- `app/routers/community.py`: reviews (learners with a finished lesson; author replies), lesson comments (one level of replies), reports (3 distinct reporters hide the target), moderation for `ADMIN_EMAILS`.
- `app/routers/users.py`: `/me/` profile, `/me/export/`, public `/users/{id}/`, `/uploads/` (lesson images re-encoded, files checked by signature, 500 MB quota), and `DELETE /internal/users/{auth_id}/` guarded by `INTERNAL_API_SECRET` (called by Better Auth when an account is deleted).
- Lessons store content as JSONB `blocks` validated by `schemas.Block` (text Markdown, video, link, callout, quiz); `PUT /courses/{id}/` replaces a course, keeping stage/lesson rows sent with their id; `kept_images` picks covers to keep. Stage/lesson order constraints are deferred to commit so reorders work.
- `app/limits.py`: `BodySizeLimitMiddleware` (streamed byte count, 413) and `rate_limit(bucket, limit)` dependencies backed by the `rate_limits` table. `app/routers/drafts.py`: per-author builder drafts (`course_drafts`). Non-owners get quizzes via `public_block` (no answers); `check_quiz` grades.
- `app/schemas.py`: request validation and response shapes; limits must match `Frontend/src/utils/validation.ts`.
- `app/media.py`: upload validation (Pillow-verified JPEG/PNG/GIF/WebP, ≤5 files, ≤5 MB each), random file names, cleanup on failure/delete.
- `app/models.py` + `migrations/`: schema. Change models, then `alembic revision --autogenerate`, review, `alembic upgrade head`; never edit applied migrations.
- `app/seed.py`: demo courses on an empty DB (`python -m app.seed`, dev only, no users).
- `entrypoint.sh`: migrations, optional seed, then uvicorn (`--reload` in dev, workers in prod).

Treat auth, ownership checks, schemas, migrations, settings and media paths as high-risk. There is no cache, task queue, tenant model, payments or external storage.
