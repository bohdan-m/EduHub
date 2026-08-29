# EduHub frontend

The EduHub frontend is a React 19 + TypeScript single-page application built with Vite. It consumes the Django API at `${VITE_API_URL}/api` (default: `http://localhost:8000/api`).

Read [AI_CONTEXT.md](AI_CONTEXT.md), [TESTING.md](TESTING.md), and [AGENTS.md](AGENTS.md) before changing it. For the complete stack, use the root [README](../README.md) and Docker Compose.

```bash
npm ci
npm run dev -- --host 0.0.0.0
npm run lint
npm run test:unit
npm run build
```
