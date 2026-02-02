# EduHub

EduHub is a full-stack educational platform designed to demonstrate comprehensive backend and frontend skills. The project allows users to interact with courses in different roles and showcases a well-structured API and modern frontend integration.

---

## About the Project

The main goal of EduHub is to create a platform where **teachers** can create and manage courses, and **students** can browse and complete lessons.
It is built with **Django** for the backend and **React + TypeScript** (planned) for the frontend, emphasizing clean architecture, RESTful API design, and role-based access control.

---

## Features

* **User Roles**

  * Students and teachers with different permissions
  * Secure authentication and authorization

* **Courses**

  * Teachers can create courses with title, description, and preview images
  * Courses consist of multiple stages, and stages consist of lessons
  * Lessons include title and embedded video links

* **Browsing & Learning**

  * Students can view available courses, navigate stages, and watch lessons
  * Progress tracking per course

* **Admin Interface**

  * Full Django Admin support for managing users, courses, stages, and lessons

* **API**

  * RESTful API built with Django REST Framework
  * Role-based permissions for different user actions
  * Optimized queries and pagination

---

## Tech Stack

* **Backend:** Python, Django, Django REST Framework, PostgreSQL
* **Frontend:** React, TypeScript
* **Other:** JWT authentication, Docker for deployment

---

## Quick Start with Docker

1. Copy the example env file: `cp .env.example .env`

2. Launch the project:

```bash
docker compose up -d
```

This will build images, run migrations, optionally populate the database (dev), and expose backend at http://localhost:8000 and frontend at http://localhost:5173.

---

## Environment

One `.env` file drives both dev and prod. Set `ENVIRONMENT=dev` or `ENVIRONMENT=prod`:

| Variable | Dev | Prod |
|----------|-----|------|
| `ENVIRONMENT` | `dev` | `prod` |
| `DJANGO_DEBUG` | `true` | `false` |
| `ENABLE_POPULATE_DB` | `true` (optional) | `false` |

**Production:** Set strong `DJANGO_SECRET_KEY` and `POSTGRES_PASSWORD`; never commit `.env`.

---

## About `populate_db`

When `ENVIRONMENT=dev` and `ENABLE_POPULATE_DB=true`, the backend seeds demo data on startup:

* Users: **student** / **teacher** (password: `1234`)
* Two demo courses with stages and lessons

It runs only once (skips if courses exist). Set `ENABLE_POPULATE_DB=false` to disable.

---

EduHub is designed to be a comprehensive portfolio project that demonstrates the ability to build a fully functional full-stack application with clean backend architecture, RESTful API design, and frontend integration.
