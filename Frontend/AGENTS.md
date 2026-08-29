# Frontend agent notes

Apply the parent [workflow](../AGENTS.md) and [testing rules](../TESTING.md). Keep UI changes scoped to `Frontend/`; trace any contract change through `src/api/` and coordinate the matching Django endpoint. Use accessible selectors/labels or explicit test IDs for future browser tests. Do not treat mocked/local fallback behavior as proof of backend integration, and never expose localStorage JWT data in logs or test evidence.
