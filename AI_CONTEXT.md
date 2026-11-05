# EduHub workspace context

## Scope and repository boundary

This workspace is **one Git repository**: EduHub. It is a small full-stack learning platform, not a collection of independently versioned repositories. Its two deployable application directories are:

- `Frontend/`: Next.js 16 (App Router) + React 19 + TypeScript app, styled with HeroUI v3 on Tailwind CSS 4.
- `Backend/`: FastAPI API (SQLAlchemy 2, Alembic, Pydantic 2).

`docker-compose.yml` is the integration boundary. It runs PostgreSQL 15 (`db`), the FastAPI API (`web`), and the Next.js dev server (`frontend`) on one `eduhub-network`. Do not change both applications merely because they share this repository: cross-boundary changes need an API-contract reason.

## Architecture map

| Area | Source of truth | Local endpoint / dependency |
| --- | --- | --- |
| Browser app | `Frontend/src/` | `http://localhost:5173`; `NEXT_PUBLIC_API_URL` defaults to `http://localhost:8000` |
| API | `Backend/app/main.py`, `Backend/app/routers/` | `http://localhost:8000/api/`; health: `/api/health/`; docs (dev): `/api/docs` |
| Database | `Backend/app/models.py`, Alembic migrations in `Backend/migrations/versions/` | PostgreSQL 15, Compose service `db:5432` |
| Auth | Better Auth in `Frontend/src/lib/` (`/api/auth/*`), `Backend/app/auth.py` | Better Auth owns sign-up/login/sessions/Google, email confirmation and optional two-factor (HttpOnly cookie, tables in the Postgres `auth` schema); the API verifies its 15-minute EdDSA JWTs via JWKS and mirrors users by `auth_id` |
| Course domain | `Backend/app/routers/courses.py`, `Backend/app/schemas.py`, course pages/API client | public list/detail; lessons hold JSON content blocks (text/video/link/callout/quiz); any signed-in account creates, only the author edits (PUT, ids kept) or deletes; `?mine=true` lists own courses; multipart image upload supported |
| Assets / logs | `Backend/media/` | demo images plus uploads in `media/course_previews/`, served by the API at `/media/`; request logs go to stdout |
| Delivery / CI | `docker-compose.yml`, Dockerfiles, `.github/workflows/ci.yml` | dev runs `next dev` and `uvicorn --reload`; prod entrypoint starts uvicorn workers; no separate IaC or deployment manifest is present |

API routes are registration/login, token refresh/logout, course list/detail/create/delete, and health. There is no checked-in OpenAPI/Swagger configuration, queue, cache, object storage integration, payment/accounting flow, or browser-E2E framework.

## Priorities and caution areas

The worktree was clean when this context was written; inspect `git status --short` before every edit because that can change. Test coverage: backend pytest suite (`Backend/tests/`), TypeScript utility tests, an end-to-end HTTP test of the running stack (`Backend/e2e/`) and Playwright browser tests (`Frontend/e2e/`). CI also builds both Docker images, starts the Compose stack and runs both end-to-end suites against it. Production runs from `docker-compose.prod.yml` (Caddy for HTTPS, nightly backups).

Treat these as high-risk areas:

- `Backend/app/config.py`, `Backend/app/main.py`, `.env`, `.env.example`, Compose and Dockerfiles: secrets, CORS, production security, database connectivity, and startup behavior.
- `Backend/migrations/versions/`: add Alembic migrations; do not edit applied ones.
- `Backend/app/auth.py`, `Frontend/src/lib/auth-options.ts`, and `Frontend/src/api/axios.config.ts`: authentication, ownership checks, and token handling.
- `Backend/app/schemas.py`, `Backend/app/media.py`: nested writes and uploads must stay atomic and validated.
- `.env` is ignored and must never be printed or committed. User uploads in `Backend/media/course_previews/` are local data.

The root `.env.example` is the safe configuration template. Compose volumes (`pgdata`, `frontend_node_modules`) and frontend `dist/`, `node_modules/`, `.tmp-tests/` are generated and should not be hand-edited.

## Finding the correct change surface

1. Start at the root, read [AGENTS.md](AGENTS.md) and [TESTING.md](TESTING.md), then inspect `git status --short`.
2. For browser/UI/API-client work, read `Frontend/AI_CONTEXT.md`; for API, database, or auth work, read `Backend/AI_CONTEXT.md`.
3. Trace a proposed full-stack change from the React API client to `Backend/app/routers/`, then the matching schema, model and migration. Treat those code paths and the tests as authoritative over prose.
4. Use the smallest relevant validation in the local `TESTING.md`, then use Compose for behavior spanning the browser/API/database boundary.

## Current validation baseline

The checked-in runtime targets are Node 22 (CI/Docker), Python 3.12 (CI/Docker), and PostgreSQL 15. Local host tooling may differ; Docker is the reproducible stack. See [TESTING.md](TESTING.md) for exact commands and evidence requirements.
