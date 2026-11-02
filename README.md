# EduHub

EduHub is a Dockerized Django + React educational platform. The backend lives in `Backend/`, the frontend lives in `Frontend/`, and `docker-compose.yml` brings up PostgreSQL, Django, and the Next.js frontend together for local development.

## Run The Full Stack

```bash
cp .env.example .env
docker compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- Backend health: `http://localhost:8000/api/health/`

## Development Checks

Frontend:

- `cd Frontend && npm install`
- `npm run check`

Backend:

- `cd Backend`
- `python manage.py migrate`
- `python manage.py test`

## Demo Data

When `ENVIRONMENT=dev` and `ENABLE_POPULATE_DB=true`, the backend seeds demo users and courses on startup.

- `teacher` / `teacher-demo-123`
- `student` / `student-demo-123`

## Notes

- The frontend still includes a local fallback mode so it can be reviewed even if the backend is temporarily unavailable.
- Auth persistence in the frontend uses local storage (`user-storage`). Treat its JWT values as sensitive and do not log them.
- The backend now exposes a simple health endpoint used by Docker health checks.
