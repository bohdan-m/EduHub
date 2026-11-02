# Frontend context

This is the Next.js 16 (App Router) + React 19 + TypeScript browser application, styled with HeroUI v3 on Tailwind CSS 4 with Tabler icons, within the parent EduHub repository. Follow the workspace [context](../AI_CONTEXT.md) and [workflow](../AGENTS.md).

Routes live in `src/app/`: `(auth)` holds `/login` and `/register` (no site header/footer), `(site)` holds `/home`, the informational pages, `/courses/[id]`, and `/courses/create`; `/` and unknown URLs redirect. Pages that read the session or theme are client components. `src/api/axios.config.ts` builds requests to `${NEXT_PUBLIC_API_URL}/api` (default `http://localhost:8000/api`); `src/api/auth.api.ts` contains auth/course calls. The Zustand store persists JWT user data in `localStorage` under `user-storage` and rehydrates after mount (`useHasHydrated` tells when it is loaded); do not log it or weaken refresh/error handling. Course creation can send JSON or multipart form data with images.

Use existing npm scripts and read [TESTING.md](TESTING.md) for commands and browser evidence. There is no checked-in browser-E2E configuration. `node_modules/`, `dist/`, and `.tmp-tests/` are generated.
