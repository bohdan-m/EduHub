# EduHub testing and evidence standard

Read this with [AGENTS.md](AGENTS.md). Commands below are derived from `Frontend/package.json`, `Backend/requirements*.txt`, `docker-compose.yml`, and `.github/workflows/ci.yml`; they are not claims that a command has been run in a particular change.

## Setup and reachability

Use Node 22, Python 3.12, PostgreSQL 15, and Docker Compose for the reproducible stack. The repository uses npm (`Frontend/package-lock.json`) and pip (`Backend/requirements.txt`, `Backend/requirements-dev.txt`); do not substitute another package manager.

```bash
cp .env.example .env                 # edit locally; do not print or commit it
docker compose up --build
```

Compose runs `db` (PostgreSQL 15), `web` (FastAPI, port 8000), and `frontend` (Next.js dev server, port 5173). The API applies Alembic migrations at container startup and seeds only when `ENVIRONMENT=dev` and `ENABLE_POPULATE_DB=true`. Check status and logs without exposing environment values:

```bash
docker compose ps
docker compose logs --tail=100 web
docker compose logs --tail=100 frontend
docker compose logs --tail=100 db
curl -fsS http://localhost:8000/api/health/
curl -fsS http://localhost:5173/
```

Outside production the API serves OpenAPI docs at `http://localhost:8000/api/docs`; `Backend/app/routers/` and `Backend/app/schemas.py` are the contract; make safe API requests with a local test account and never paste bearer tokens, cookies, passwords, or unnecessary PII into output.

For host-only work, install from lockfiles/requirements only when needed:

```bash
(cd Frontend && npm ci)
(cd Backend && python3.12 -m pip install -r requirements-dev.txt)
```

The API on the host needs a reachable PostgreSQL and the POSTGRES_* / BETTER_AUTH_* values exported in the environment. Start only the needed process with `cd Frontend && npm run dev -- --hostname 0.0.0.0` or `cd Backend && uvicorn app.main:app --reload`. Do not run migrations, seed commands, installs, or `docker compose down -v` merely to validate documentation; those change state. There is no auth bypass and no demo account: sign up through the app (Better Auth) for a local test account.

## Automated checks

```bash
(cd Frontend && npm run lint)
(cd Frontend && npm run typecheck)
(cd Frontend && npm run test:unit)
(cd Frontend && npm run build)
(cd Backend && pytest && flake8)
(cd Backend && E2E_FRONTEND_URL=http://localhost:5173 E2E_API_URL=http://localhost:8000 pytest e2e)
docker compose build
```

`npm run test:unit` compiles its test files to ignored `Frontend/.tmp-tests/` and runs Node's test runner. `pytest` is the backend unit/integration layer (real Postgres, its own `_test` database); `pytest e2e` drives the running stack over HTTP. CI runs the backend tests, frontend lint/type/unit/build checks, Docker image builds, and a Compose stack with health checks and the end-to-end test. A green build, lint run, type check, or health endpoint alone is never behavioral verification.

## What “done” requires

| Change type | Minimum evidence in addition to focused automated tests |
| --- | --- |
| Backend/API | Exercise affected endpoint/service flow; record method, safe request shape, status/response shape, and relevant sanitized service log result. |
| Frontend | Open the actual route, perform the changed interaction, verify visible result, and inspect console errors, page errors, failed requests, and unexpected HTTP responses. |
| Full stack | Verify UI action, API method/request/response contract, backend behavior/logs, and final rendered UI result. |
| Auth/permissions | Test allowed and denied roles/anonymous paths separately; do not equate a test bypass with real JWT evidence. |
| Migration/schema | Add and review generated migration, validate upgrade against a disposable/local database, and test affected reads/writes. State if a migration was intentionally not run. |
| Docker/infrastructure | Validate changed build/config and service reachability; report image/service prerequisites and logs. |
| Upload/media or document/PDF | Test representative file handling/output, error paths, media/storage configuration, and inspect the rendered artifact visually. No PDF generator exists today. |
| Queues/webhooks/payments | None exist today. If introduced, document idempotency, retries, signatures, failure handling, and an isolated test flow before calling it done. |

For any calculation or future financial workflow, tests must name the source-of-truth example, explicit inputs/outputs, rounding rule, lifecycle/schedule behavior, and representative plus edge-case regressions. For any multi-tenant capability introduced later, test cross-tenant denial explicitly; EduHub currently has roles but no tenant model.

## Browser runtime verification

No Playwright/Cypress configuration or browser binaries are currently checked in. Do not invent a browser command or claim browser coverage. When adding Playwright, pin it in `Frontend/package.json`, use `npx playwright install` only after stating the browser download need, and add scripts for headless, headed (`--headed`), screenshots/traces/video, and HTML reports. If managed browsers are unavailable, use an installed local browser and report the exact limitation.

Use selectors in this order: accessible role, `data-testid`, associated label, stable visible text, CSS only as a last resort. Runtime automation must collect `console`, `pageerror`, `requestfailed`, and unexpected non-success HTTP responses; retain sanitized screenshots/traces/reports as evidence. Correlate a UI action with the browser network request and `docker compose logs --tail=100 web` (the API logs each request to stdout).

## Evidence and blocker report

Report the exact command and exit result, then the route/interaction or API method, sanitized request/response, visible result, console/page/network errors, relevant logs, and failures. Say what was not run and why. Missing Docker, browser binaries, credentials, database, services, or external dependencies are blockers—not permission to guess. Never include secrets, access/refresh tokens, passwords, cookies, or unnecessary personal data in evidence.
