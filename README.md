# EduHub

EduHub is an online-courses platform: teachers publish courses made of stages and YouTube lessons, students browse and watch them.

| Part | Stack | Folder |
|---|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, HeroUI v3, Tailwind CSS 4 | `Frontend/` |
| Auth | [Better Auth](https://better-auth.com) inside the Next.js app: email/password, optional Google sign-in | `Frontend/src/lib/` |
| API | FastAPI, SQLAlchemy 2, Alembic, Pydantic 2 (Python 3.12) | `Backend/` |
| Database | PostgreSQL 15 (API tables in `public`, Better Auth tables in the `auth` schema) | Docker volume `pgdata` |

## Run the full stack

```bash
cp .env.example .env
# set POSTGRES_PASSWORD and BETTER_AUTH_SECRET (openssl rand -base64 32) in .env
docker compose up --build
```

- App: http://localhost:5173
- API: http://localhost:8000 (health: `/api/health/`, interactive docs in dev: `/api/docs`)

On start the API applies its database migrations (`alembic upgrade head`) and, in dev with `ENABLE_POPULATE_DB=true`, seeds the demo courses. The Next.js server creates Better Auth's tables on start. Code changes in both apps reload automatically.

To turn on Google sign-in, create an OAuth client ("Web application") in Google Cloud Console with the redirect URI `http://localhost:5173/api/auth/callback/google`, put its ID and secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, and restart the frontend.

## How auth works

1. The browser signs up, logs in or uses Google through Better Auth at `/api/auth/*` on the Next.js server. The session is an HttpOnly cookie.
2. For API calls the frontend gets a short-lived JWT from Better Auth (15 minutes, EdDSA-signed, carries the user's role) and sends it as `Authorization: Bearer …`.
3. FastAPI verifies the signature against Better Auth's public keys (`/api/auth/jwks`), plus expiry, issuer, audience and role, and keeps a local `users` row for each account (`auth_id` = Better Auth user id).
4. The role (student or teacher) is chosen once at sign-up; Better Auth refuses later changes. Teachers can create and delete their own courses; everyone can browse.

The API has no login or password code of its own.

## Tests

```bash
# API: unit + integration tests against a throwaway "<POSTGRES_DB>_test" database (needs a reachable Postgres)
cd Backend && pip install -r requirements-dev.txt && pytest && flake8

# Frontend: lint, types, unit tests, production build
cd Frontend && npm ci && npm run lint && npm run typecheck && npm run test:unit && npm run build

# End to end, against the running Docker stack: sign-up/login, API tokens, roles, course upload/delete, logout
cd Backend && E2E_FRONTEND_URL=http://localhost:5173 E2E_API_URL=http://localhost:8000 pytest e2e
```

CI (`.github/workflows/ci.yml`) runs all of the above, builds both Docker images and runs the end-to-end test against a fresh Compose stack.

## Demo data

With `ENVIRONMENT=dev` and `ENABLE_POPULATE_DB=true`, an empty database gets the demo courses (shown as authored by "EduHub"). No user accounts are created: sign up through the app.

## Database migrations

Schema changes go through Alembic in `Backend/migrations/` (`alembic revision --autogenerate -m "..."`, review it, then `alembic upgrade head`; `alembic check` fails if models and migrations drift). Migration `0002` moved data from the earlier Django schema and removed its tables; it does nothing on a fresh database.

## Notes

- Treat session cookies, API tokens and `.env` as secrets; never log them.
- Uploaded course images are validated (JPEG/PNG/GIF/WebP, up to 5 images of 5 MB each), stored under random names in `Backend/media/course_previews/` and served by the API at `/media/`.
