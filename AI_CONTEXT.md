# EduHub workspace context

## Scope and repository boundary

This workspace is **one Git repository**: EduHub. It is a small full-stack learning platform, not a collection of independently versioned repositories. Its two deployable application directories are:

- `Frontend/`: React 19 + TypeScript + Vite single-page application.
- `Backend/`: Django 4.2 + Django REST Framework API.

`docker-compose.yml` is the integration boundary. It runs PostgreSQL 15 (`db`), Django (`web`), and Vite (`frontend`) on one `eduhub-network`. Do not change both applications merely because they share this repository: cross-boundary changes need an API-contract reason.

## Architecture map

| Area | Source of truth | Local endpoint / dependency |
| --- | --- | --- |
| Browser app | `Frontend/src/` | `http://localhost:5173`; `VITE_API_URL` defaults to `http://localhost:8000` |
| API | `Backend/config/urls.py`, `users/`, `courses/` | `http://localhost:8000/api/`; health: `/api/health/` |
| Database | Django migrations in `Backend/users/migrations/` and `Backend/courses/migrations/` | PostgreSQL 15, Compose service `db:5432` |
| Auth | `users` app, SimpleJWT, `Frontend/src/api/axios.config.ts` | JWT access/refresh tokens; browser state persists in **localStorage** (`user-storage`) |
| Course domain | `Backend/courses/`, course pages/API client | public list/detail; teacher-only create/delete; multipart image upload supported |
| Assets / logs | `Backend/media/`, `Backend/logs/` | media is served by Django only with `DEBUG=true`; request logs are local or stdout in prod |
| Delivery / CI | `docker-compose.yml`, Dockerfiles, `.github/workflows/ci.yml` | dev runs Vite and Django; prod entrypoint starts Gunicorn; no separate IaC or deployment manifest is present |

API routes are registration/login, token refresh/logout, course list/detail/create/delete, and health. There is no checked-in OpenAPI/Swagger configuration, queue, cache, object storage integration, payment/accounting flow, or browser-E2E framework.

## Priorities and caution areas

The worktree was clean when this context was written; inspect `git status --short` before every edit because that can change. Existing test coverage is Django app tests and TypeScript utility tests. CI also builds both Docker images and starts the Compose stack.

Treat these as high-risk areas:

- `Backend/config/settings.py`, `.env`, `.env.example`, Compose and Dockerfiles: secrets, CORS, production security, database connectivity, and startup behavior.
- `Backend/*/migrations/`: append migrations through Django; do not edit applied migration history casually.
- `Backend/users/`, `Backend/courses/permissions.py`, and frontend token refresh/store code: authentication, role authorization, and token handling.
- `Backend/courses/serializers.py` and image/media configuration: nested writes and uploads must stay atomic and validated.
- `.env` is ignored and must never be printed or committed. User-uploaded `Backend/media/` and request logs are generated/local data.

The root `.env.example` is the safe configuration template. Compose volumes (`pgdata`, `frontend_node_modules`) and frontend `dist/`, `node_modules/`, `.tmp-tests/` are generated and should not be hand-edited.

## Finding the correct change surface

1. Start at the root, read [AGENTS.md](AGENTS.md) and [TESTING.md](TESTING.md), then inspect `git status --short`.
2. For browser/UI/API-client work, read `Frontend/AI_CONTEXT.md`; for Django, database, auth, or API work, read `Backend/AI_CONTEXT.md`.
3. Trace a proposed full-stack change from the React API client to `Backend/config/urls.py`, then the matching app view/serializer/model and migration. Treat those code paths and the tests as authoritative over prose.
4. Use the smallest relevant validation in the local `TESTING.md`, then use Compose for behavior spanning the browser/API/database boundary.

## Current validation baseline

The checked-in runtime targets are Node 22 (CI/Docker), Python 3.10 (CI/Docker), and PostgreSQL 15. Local host tooling may differ; Docker is the reproducible stack. See [TESTING.md](TESTING.md) for exact commands and evidence requirements.
