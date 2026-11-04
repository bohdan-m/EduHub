# Backend testing

Use the shared [testing standard](../TESTING.md). Runtime: Python 3.12, PostgreSQL 15; dependencies pinned in `requirements.txt` (runtime) and `requirements-dev.txt` (tests, lint).

```bash
pip install -r requirements-dev.txt
pytest                      # tests/: needs a reachable Postgres (POSTGRES_* env); uses "<POSTGRES_DB>_test"
pytest tests/test_auth.py   # one file
flake8
alembic check               # models and migrations agree (run against a migrated database)
uvicorn app.main:app --reload
```

`pytest` creates the `_test` database if needed, applies the Alembic migrations to it, and empties the tables after every test; it refuses to run against a database whose name doesn't end in `_test`. Auth tests sign real EdDSA tokens with a generated key and replace only the JWKS lookup, so signature, expiry, issuer and audience checks all run for real.

`e2e/` is a black-box test of the running stack (Better Auth + API + Postgres) over HTTP:

```bash
E2E_FRONTEND_URL=http://localhost:5173 E2E_API_URL=http://localhost:8000 pytest e2e
```

It is skipped unless both variables are set and leaves its `@e2e.test` accounts in that stack's database.

With Compose, use `docker compose logs --tail=100 web` and exercise `http://localhost:8000/api/health/` plus the relevant `/api/` route. For auth changes, test guest and signed-in behavior and ownership denial (another account's course is a 404). For upload work, cover JSON and multipart plus the error paths.
