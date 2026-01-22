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

To launch the entire project, simply run:

```bash
docker compose up -d
```

That’s it — this command will automatically:

1. Build the Docker images (if not yet built)
2. Run all necessary default setup commands
3. Initialize the database with default data via:

   ```bash
   python manage.py populate_db
   ```

---

## About `populate_db`

The `populate_db` command runs automatically **during the first container build**.
It fills the database with essential demo data, including:

* Two users:

  * **student** → password: `1234`
  * **teacher** → password: `1234`
* Two demo courses with related stages and lessons

This script **will not run again** automatically, because it includes an internal check to ensure it only executes once.

---

## Disabling Initial Population

If you don’t want the database to be pre-filled during the first build,
you can disable it by **removing line 7** from the `docker compose.yml` file —
that’s the line responsible for calling the population script.

---

EduHub is designed to be a comprehensive portfolio project that demonstrates the ability to build a fully functional full-stack application with clean backend architecture, RESTful API design, and frontend integration.
