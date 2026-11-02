# Backend testing

Use the shared [testing standard](../TESTING.md). Supported reproducible runtime: Python 3.10, requirements in `config/requirements.txt`, and PostgreSQL 15. The host test command needs the configured PostgreSQL service and safe root `.env` values; Compose is the standard local stack.

```bash
python3.10 -m pip install -r config/requirements.txt
python manage.py test
python manage.py test courses.tests.test_views
python manage.py check
python manage.py runserver
```

With Compose, use `docker compose logs --tail=100 web` and exercise `http://localhost:8000/api/health/` plus the relevant `/api/` route. For auth/authorization changes, test anonymous, student, and teacher behavior and ownership denial. For serializer or image work, cover JSON and multipart/error paths as applicable. Do not run `migrate` or `populate_db` just for documentation validation; report if database/runtime prerequisites prevented a check.
