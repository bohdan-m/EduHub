# Frontend context

This is the React 19 + TypeScript + Vite browser application within the parent EduHub repository. Follow the workspace [context](../AI_CONTEXT.md) and [workflow](../AGENTS.md).

`src/App.tsx` owns browser routes: `/login`, `/register`, `/home`, informational pages, `/courses/:courseId`, and `/courses/create`. `src/api/axios.config.ts` builds requests to `${VITE_API_URL}/api` (default `http://localhost:8000/api`); `src/api/auth.api.ts` contains auth/course calls. The Zustand store persists JWT user data in `localStorage` under `user-storage`; do not log it or weaken refresh/error handling. Course creation can send JSON or multipart form data with images.

Use existing npm scripts and read [TESTING.md](TESTING.md) for commands and browser evidence. There is no checked-in browser-E2E configuration. `node_modules/`, `dist/`, and `.tmp-tests/` are generated.
