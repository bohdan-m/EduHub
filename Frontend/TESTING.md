# Frontend testing

Use the shared [testing standard](../TESTING.md). Node 22 and npm with `package-lock.json` are the supported tooling.

```bash
npm ci
npm run dev -- --hostname 0.0.0.0
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

The Next.js dev server is normally reachable at `http://localhost:5173`; API calls require the Django API at the `NEXT_PUBLIC_API_URL` value. Utility tests live in `tests/` and compile to `.tmp-tests/`. For changed UI/client behavior, independently test the actual route and interaction and capture visible output plus console/page/request failures. No Playwright/Cypress command is available until one is deliberately added and documented.
