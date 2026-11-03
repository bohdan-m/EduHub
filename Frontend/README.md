# EduHub frontend

Next.js 16 (App Router) + React 19 + TypeScript, styled with HeroUI v3 on Tailwind CSS 4, icons from Tabler.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build (standalone server in .next/standalone)
npm run lint
npm run typecheck
npm run test:unit  # utility tests in tests/ (node:test)
```

`NEXT_PUBLIC_API_URL` points at the FastAPI backend (default `http://localhost:8000`, `/api` is appended in code).
Put it in `.env.local` for local runs. It is baked into the bundle at build time, so the prod Docker image takes it as a build arg.

Layout: routes live in `src/app` — `(site)` pages get the header and footer, `(auth)` pages (login, register) don't.
Auth is Better Auth (`src/lib/`): the session is an HttpOnly cookie read with `authClient.useSession()`, and API calls carry a short-lived JWT (`src/api/axios.config.ts`). Only the theme choice is kept in localStorage.
