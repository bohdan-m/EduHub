# Backend context

This is EduHub’s Django 4.2 + Django REST Framework API. Follow the parent [context](../AI_CONTEXT.md) and [workflow](../AGENTS.md). `config/settings.py` uses PostgreSQL and reads the root `.env` in non-production. Django migrations live in `users/migrations/` and `courses/migrations/`; create new migrations rather than editing applied ones.

`config/urls.py` exposes `/api/health/`, registration/login, JWT refresh/logout, and course routes. DRF defaults to JWT authentication and authenticated access; the public course list/detail views explicitly allow anonymous access. `IsTeacher` gates course creation/deletion, while deletion’s queryset restricts a teacher to their own courses. Course nested writes and uploads are in `courses/serializers.py` and are atomic. Local request logs go to `logs/django_requests.log` when writable; production logs use stdout.

There is no OpenAPI configuration, cache, task queue, tenant model, payments, or external storage provider. Treat auth, roles, serializers, migrations, settings, and media paths as high-risk.
