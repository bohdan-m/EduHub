# EduHub

EduHub is an online-courses platform: every account can build courses (stages of lessons made of text, video, image, link, file, callout and quiz blocks), keep them as drafts and publish them; everyone can browse, search and take them.

What's in it:

- **Learners:** a searchable catalogue (category, level, sort by newest, learners or rating), enrolling, progress per lesson with "continue where you left off", private notes and bookmarks per lesson, quizzes (multiple choice, true/false, short answer, matching) graded on the server, a completion certificate with a public link, and a "My learning" page.
- **Authors:** a course builder with drafts saved to the server, publishing states (draft, unlisted, published), course details (category, level, language, what you'll learn, requirements, intro video), image and file uploads, duplicating a lesson, block or whole course, a dashboard ("Teach") and per-course stats (completion per lesson, hardest quizzes).
- **Community:** star ratings and reviews (from learners who finished a lesson) with author replies, a discussion under every lesson, public author pages, and reports that hide content after three people flag it until a moderator decides (`/moderation`, for the emails in `ADMIN_EMAILS`).
- **Accounts:** email confirmation, optional two-factor sign-in, password reset and change, email change, a list of signed-in devices, data export and account deletion (confirmed by email).

| Part | Stack | Folder |
|---|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, HeroUI v3, Tailwind CSS 4 | `Frontend/` |
| Auth | [Better Auth](https://better-auth.com) inside the Next.js app: email/password with email confirmation, optional two-factor, optional Google sign-in | `Frontend/src/lib/` |
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
- Mail: http://localhost:8025 (Mailpit catches every email the app sends, such as sign-up confirmation links; nothing leaves your machine)

On start the API applies its database migrations (`alembic upgrade head`) and, in dev with `ENABLE_POPULATE_DB=true`, seeds the demo courses. The Next.js server creates Better Auth's tables on start. Code changes in both apps reload automatically.

To turn on Google sign-in, create an OAuth client ("Web application") in Google Cloud Console with the redirect URI `http://localhost:5173/api/auth/callback/google`, put its ID and secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, and restart the frontend.

For real email (production), set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and `MAIL_FROM` in `.env` to any SMTP provider. Outside Docker and without `SMTP_HOST`, the dev server prints emails to its log instead.

## How auth works

1. The browser signs up, logs in or uses Google through Better Auth at `/api/auth/*` on the Next.js server. The session is an HttpOnly cookie.
2. A new email/password account gets no session until its address is confirmed: Better Auth emails a link (valid 1 hour) that confirms it and signs the user in. Logging in to an unconfirmed account sends a fresh link. Google addresses count as confirmed.
3. Forgot password (`/forgot-password`) emails a one-time link, valid 1 hour, to a page for choosing a new password. The answer is the same whether or not the address has an account, and a reset signs the account out on every device.
4. Two-factor authentication is optional per account (Settings page): an authenticator-app code (TOTP) plus 10 one-time backup codes. With it on, a correct password only opens the `/two-factor` step; the session starts after the code.
5. For API calls the frontend gets a short-lived JWT from Better Auth (15 minutes, EdDSA-signed) and sends it as `Authorization: Bearer …`.
6. FastAPI verifies the signature against Better Auth's public keys (`/api/auth/jwks`), plus expiry, issuer and audience, and keeps a local `users` row for each account (`auth_id` = Better Auth user id).
7. There are no roles: any signed-in account can create courses and edit (`PUT /api/courses/{id}/`) or delete its own; everyone can browse. `GET /api/courses/?mine=true` lists the caller's own courses.
8. Learners get quizzes without their answers; `POST /api/courses/{id}/lessons/{lesson}/quizzes/{block}/check/` grades an attempt on the server. Authors see their quizzes in full.
9. The course builder autosaves drafts to the API (`/api/drafts/`, one per author and course), so unsaved work follows the author to any device.
10. New courses are drafts only their author sees; unlisted ones open by link; published ones are in the catalogue. Publishing needs content in every lesson.
11. Deleting an account (Settings, confirmed from an emailed link) makes the Next.js server call `DELETE /api/internal/users/{id}/` with `INTERNAL_API_SECRET`, so the API removes that account's courses, progress, reviews, comments and files before the account goes.

Limits: course writes (30/min), draft saves (60/min), progress updates (120/min), quiz checks (120/min), uploads (30/min) and reviews/comments/reports (10/min) are rate-limited per user (per address for guests), counted in Postgres so every API worker shares them; request bodies are capped (5 MB of JSON, 30 MB with uploads) while they stream, whatever the declared size. Sign-in, sign-up, password reset and two-factor checks have their own limits in Better Auth, also stored in the database. New passwords that appear in known data breaches are refused (Have I Been Pwned, checked by hash prefix). Uploaded images are re-encoded as WebP, which drops camera and location metadata, with small thumbnails for cards. Pages send a Content Security Policy with a per-request nonce (`Frontend/src/proxy.ts`), so only the app's own scripts run.

The API has no login or password code of its own.

## Tests

```bash
# API: unit + integration tests against a throwaway "<POSTGRES_DB>_test" database (needs a reachable Postgres)
cd Backend && pip install -r requirements-dev.txt && pytest && flake8

# Frontend: lint, types, unit tests, production build
cd Frontend && npm ci && npm run lint && npm run typecheck && npm run test:unit && npm run build

# End to end, against the running Docker stack: sign-up with email confirmation and password reset (links read from Mailpit), two-factor sign-in,
# API tokens, course ownership, upload/delete, logout
cd Backend && E2E_FRONTEND_URL=http://localhost:5173 E2E_API_URL=http://localhost:8000 pytest e2e

# In a real browser, against the same stack: sign-up and password reset; building, publishing and taking a course;
# progress, notes, quizzes, discussion, reviews and the certificate; the author's stats; Settings (profile, export,
# password change, account deletion); the phone curriculum; start page, legal pages and 404
cd Frontend && npx playwright install chromium && npm run test:e2e   # or E2E_BROWSER_CHANNEL=chrome to use an installed Chrome
```

CI (`.github/workflows/ci.yml`) runs all of the above, audits the shipped dependencies (`npm audit`, `pip-audit`), builds both Docker images and runs both end-to-end suites against a fresh Compose stack. The end-to-end tests need mail to reach Mailpit, so leave `SMTP_*` unset in `.env` while running them locally, and set `AUTH_RATE_LIMIT_SCALE=50`: they sign up more accounts a minute than the sign-up limit allows.

## Deploying

`docker-compose.prod.yml` runs the production images behind [Caddy](https://caddyserver.com), which gets HTTPS certificates by itself:

```bash
# in .env: ENVIRONMENT=prod, SITE_DOMAIN=eduhub.example.com, API_DOMAIN=api.eduhub.example.com,
# strong POSTGRES_PASSWORD / BETTER_AUTH_SECRET / INTERNAL_API_SECRET, a real SMTP server, ADMIN_EMAILS
docker compose -f docker-compose.prod.yml up -d --build
```

Point both domains' DNS at the server first. Uploads live in the `media` volume. A `backup` service writes a database dump and an archive of the uploads to `./backups` every night and keeps 14 days; copy that folder off the server (rsync, rclone) as well. Set `SENTRY_DSN` for error reports from the API, and point an uptime monitor at `https://<API_DOMAIN>/api/health/`.

## Demo data

With `ENVIRONMENT=dev` and `ENABLE_POPULATE_DB=true`, an empty database gets the demo courses (shown as authored by "EduHub"). No user accounts are created: sign up through the app.

## Database migrations

Schema changes go through Alembic in `Backend/migrations/` (`alembic revision --autogenerate -m "..."`, review it, then `alembic upgrade head`; `alembic check` fails if models and migrations drift). Migration `0002` moved data from the earlier Django schema and removed its tables; it does nothing on a fresh database. Migration `0003` dropped the student/teacher roles.

## Notes

- Treat session cookies, API tokens and `.env` as secrets; never log them.
- Uploaded course images are validated (JPEG/PNG/GIF/WebP, up to 5 images of 5 MB each), stored under random names in `Backend/media/course_previews/` and served by the API at `/media/`.
