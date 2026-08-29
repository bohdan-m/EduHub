# Backend agent notes

Apply the parent [workflow](../AGENTS.md) and [testing rules](../TESTING.md). Keep route, serializer, permission, model, migration, and frontend contract changes consistent. Preserve atomic nested course writes, test positive and denied role/ownership paths, and use new Django migrations for schema changes. Do not log JWTs, credentials, upload contents, or personal data. Review `config/settings.py`, Compose, and the entrypoint carefully because they control database, secrets, CORS, migrations, and production Gunicorn behavior.
