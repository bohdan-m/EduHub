#!/bin/sh
set -e

echo "Running migrations..."
python manage.py migrate

if [ "$ENVIRONMENT" = "dev" ] && [ "$ENABLE_POPULATE_DB" = "true" ]; then
  echo "Populating database (dev)..."
  python manage.py populate_db
fi

if [ "$ENVIRONMENT" = "prod" ]; then
  echo "Starting Gunicorn..."
  exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 2
else
  echo "Starting Django development server..."
  exec python manage.py runserver 0.0.0.0:8000
fi
