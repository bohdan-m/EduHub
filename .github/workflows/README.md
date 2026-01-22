# CI/CD Pipeline Documentation

## Overview

This GitHub Actions CI pipeline provides comprehensive testing and validation for the EduHub project. It runs on every push and pull request to the main branches.

## Pipeline Jobs

### 1. Backend Tests
- **Purpose**: Runs Django unit tests and integration tests
- **Services**: PostgreSQL 15 (via GitHub Actions service)
- **Steps**:
  - Sets up Python 3.10
  - Installs system and Python dependencies
  - Runs database migrations
  - Executes all Django tests
  - Performs code style checks with flake8 (non-blocking)

### 2. Frontend Lint & Type Check
- **Purpose**: Validates TypeScript code quality and type safety
- **Steps**:
  - Sets up Node.js 22
  - Installs npm dependencies
  - Runs ESLint for code quality
  - Performs TypeScript type checking

### 3. Frontend Build
- **Purpose**: Verifies the frontend can be built successfully
- **Steps**:
  - Sets up Node.js 22
  - Installs dependencies
  - Builds the production bundle
  - Uploads build artifacts for potential deployment

### 4. Docker Backend Build
- **Purpose**: Validates the backend Docker image builds correctly
- **Steps**:
  - Builds the backend Docker image
  - Tests the image contains required dependencies
  - Uses Docker Buildx with caching for faster builds

### 5. Docker Frontend Build
- **Purpose**: Validates the frontend Docker image builds correctly
- **Steps**:
  - Builds the frontend Docker image
  - Verifies Node.js and npm are properly installed
  - Uses Docker Buildx with caching

### 6. Docker Compose Integration Test
- **Purpose**: Tests the full stack integration with docker compose
- **Steps**:
  - Builds all services
  - Starts database, backend, and frontend services
  - Waits for services to become healthy
  - Tests backend health endpoint
  - Verifies Django system checks
  - Cleans up services after testing

### 7. Security Scan
- **Purpose**: Scans Dockerfiles and configuration for vulnerabilities
- **Tool**: Trivy
- **Note**: Non-blocking (continue-on-error: true)
- **Output**: SARIF format uploaded to GitHub Security tab

### 8. Code Quality Checks
- **Purpose**: Additional code quality validations
- **Checks**:
  - Identifies large files (>5MB)
  - Scans for potential hardcoded secrets/passwords

### 9. CI Summary
- **Purpose**: Provides a summary of all job results
- **Output**: Markdown table in GitHub Actions summary

## Environment Variables

The pipeline uses the following environment variables (defined at the workflow level):

- `POSTGRES_USER`: postgres
- `POSTGRES_PASSWORD`: password_default
- `POSTGRES_DB`: eduhub
- `PYTHON_VERSION`: 3.10
- `NODE_VERSION`: 22

## Caching

The pipeline uses GitHub Actions caching for:
- Python pip dependencies (based on requirements.txt hash)
- Node.js npm dependencies (via actions/setup-node built-in caching)
- Docker layer caching (via GitHub Actions cache)

## Notes

1. **Database Configuration**: Ensure `Backend/config/settings.py` uses the correct database name. Currently, there may be a mismatch between settings.py (`postgres`) and docker compose.yml (`eduhub`).

2. **populate_db Command**: The docker compose integration test runs the `populate_db` management command. Ensure this command is idempotent or handles errors gracefully.

3. **Secrets**: The pipeline uses default passwords for testing. Never use these in production!

4. **Build Artifacts**: Frontend build artifacts are stored for 1 day and can be downloaded from the Actions UI.

## Running Locally

To run similar checks locally:

```bash
# Backend tests
cd Backend
python manage.py test

# Frontend lint
cd Frontend
npm run lint
npx tsc --noEmit --project tsconfig.app.json

# Frontend build
npm run build

# Docker builds
docker compose build
docker compose up -d
```

## Troubleshooting

- **Backend tests failing**: Check PostgreSQL connection settings in `settings.py`
- **Docker builds failing**: Verify Dockerfiles are correct and all dependencies are available
- **Docker Compose test failing**: Check service health checks and ensure all services start correctly
- **TypeScript errors**: Run `npx tsc --noEmit` locally to see detailed errors
