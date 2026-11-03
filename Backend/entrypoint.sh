#!/bin/sh
set -e

echo "Applying database migrations..."
alembic upgrade head

if [ "$ENVIRONMENT" = "dev" ] && [ "$ENABLE_POPULATE_DB" = "true" ]; then
  echo "Seeding demo courses (dev)..."
  python -m app.seed
fi

if [ "$ENVIRONMENT" = "prod" ]; then
  echo "Starting Uvicorn (prod)..."
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --proxy-headers
else
  echo "Starting Uvicorn with auto-reload (dev)..."
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
fi
