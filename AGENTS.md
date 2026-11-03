# EduHub agent workflow

Every user-facing response—progress update, question, blocker, and final handoff—must address the user as **[Bohdan]**. Read [AI_CONTEXT.md](AI_CONTEXT.md), [TESTING.md](TESTING.md), and the applicable service-local guidance before changing code. Inspect `git status --short` first and preserve unrelated user changes.

## Mandatory pipeline

```text
Coder → Independent runtime tester → Fix loop if needed
      → Security/architecture reviewer → Fix/retest loop if needed
      → Done
```

The coder makes the smallest in-scope change, adds focused tests, and does not declare the task complete. The runtime tester independently exercises behavior rather than trusting the coder’s summary. For frontend work, open the actual route, perform the changed interaction, inspect console/page/network errors, and verify the visible result. For backend work, exercise the affected endpoint or equivalent service flow and verify its response and logs. For full-stack work, verify UI action, API request/response contract, backend behavior, and rendered UI outcome.

If the tester finds a defect, return a concrete reproduction to the coder; the coder fixes it and the tester repeats relevant checks. Only after runtime verification passes may the reviewer inspect the diff. The reviewer checks architecture alignment, authorization and future tenant boundaries, input validation, secret/PII exposure, injection risks, error handling, API compatibility, migrations, operational impact, and test quality. Critical findings require a fix and runtime retest before completion.

When independent agents are unavailable, perform the same stages sequentially and label that limitation plainly. Do not imply independent testing or review occurred. Follow the evidence standard in [TESTING.md](TESTING.md); a green build alone is not runtime verification.

## Change boundaries

Use `Frontend/` for React UI/client work and `Backend/` for FastAPI/database work. Cross the boundary only for an explicit contract or product-flow reason. Do not edit `.env`, generated folders, user media, applied migrations, Docker/production security settings, or auth/role checks casually. Avoid printing secrets, tokens, passwords, cookies, and unnecessary PII.
