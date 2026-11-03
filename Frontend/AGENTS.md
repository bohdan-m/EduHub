# Frontend agent notes

Apply the parent [workflow](../AGENTS.md) and [testing rules](../TESTING.md). Keep UI changes scoped to `Frontend/`; trace any contract change through `src/api/` and coordinate the matching FastAPI endpoint. Use accessible selectors/labels or explicit test IDs for future browser tests. Do not treat mocked/local fallback behavior as proof of backend integration, and never expose session cookies or API JWTs in logs or test evidence.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
