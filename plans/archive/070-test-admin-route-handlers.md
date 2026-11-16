# Plan 070: Add unit tests for admin and public API route handlers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/pages/api/`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: test-coverage
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

Five API route handlers contain meaningful business logic with no test coverage:
- `mark-shipped.ts` and `mark-pickedup.ts` — order state-machine transitions
  that email customers and update Square order status
- `shop-status.ts` — multi-action route with GET/POST/DELETE for shop open/close
- `back-in-stock.ts` — public subscription endpoint that validates input and
  stores BIS registrations
- `retry-failed-emails.ts` — admin endpoint for listing and retrying failed email
  deliveries

These handlers are the business-critical paths. Without tests, regressions from
future changes (e.g. adding new order states, changing BIS schema) are only
caught in production.

## Existing test pattern for route handlers

See `src/pages/api/__tests__/webhook-square.test.ts` (written in plan 040) as the
primary reference. That file:
- Imports the route's `POST` export directly
- Constructs a mock `Request` with `new Request(url, { method, headers, body })`
- Mocks Square SDK and email functions via `vi.mock(...)`
- Asserts on response status and JSON body

## Commands you will need

| Purpose          | Command                | Expected on success        |
|------------------|------------------------|----------------------------|
| Run tests        | `pnpm test:run`        | all pass                   |
| Coverage         | `pnpm test:coverage`   | thresholds pass            |
| Typecheck        | `pnpm check`           | exit 0                     |

## Scope

**In scope** (new test files only):
- `src/pages/api/__tests__/mark-shipped.test.ts`
- `src/pages/api/__tests__/mark-pickedup.test.ts`
- `src/pages/api/__tests__/shop-status.test.ts`
- `src/pages/api/__tests__/back-in-stock.test.ts`
- `src/pages/api/admin/__tests__/retry-failed-emails.test.ts`

**Out of scope**:
- Any source file modification
- Pure utility tests (covered in plan 069)

## Git workflow

- Branch: `advisor/070-test-admin-route-handlers`
- Commit message: `test: add unit tests for admin route handlers and back-in-stock endpoint`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read each route handler

Read the following files completely before writing any tests:

```bash
cat src/pages/api/mark-shipped.ts
cat src/pages/api/mark-pickedup.ts
cat src/pages/api/admin/shop-status.ts
cat src/pages/api/back-in-stock.ts
cat src/pages/api/admin/retry-failed-emails.ts
```

Note: file paths for admin routes may have a different subdirectory — verify with:
```bash
find src/pages/api -name "mark-shipped.ts" -o -name "shop-status.ts" -o -name "back-in-stock.ts" -o -name "retry-failed-emails.ts"
```

### Step 2: Read the reference test file

```bash
cat src/pages/api/__tests__/webhook-square.test.ts
```

Match its mock setup (`vi.mock`, `vi.fn`, `mockResolvedValue`), request
construction, and assertion patterns exactly.

### Step 3: Write tests for each handler

For each file, write tests covering:

**`mark-shipped.ts` and `mark-pickedup.ts`**:
- Missing auth → 401
- Missing order ID → 400
- Successful state transition → 200 + email sent
- Square API failure → appropriate error response

**`shop-status.ts`**:
- GET → returns current status (mock the Blob read)
- POST → updates status, returns 200
- DELETE → resets status, returns 200
- Missing auth on any method → 401

**`back-in-stock.ts`**:
- Valid email + product ID → 200 + stored
- Missing email → 400
- Duplicate subscription (same email + product) → 200 (idempotent) or 409
  (check actual behavior first)
- Invalid email format → 400 (if validated) or 200 (if not)

**`retry-failed-emails.ts`**:
- GET → returns list of failed emails (mock the Blob read)
- POST → retries specific email, returns success/failure
- Missing auth → 401 (note: plan 045 will change 302→401; test the current 302
  behavior if 045 hasn't landed)

For each handler, determine what needs to be mocked by reading the import list
at the top of the source file. Common mocks needed:
- `@/lib/admin/auth` → `isAdminAuthenticated`
- `@/lib/email/sender` → `sendEmail`
- `@/lib/cache/blobCache` or `@/lib/square/failedEmails` → Blob operations
- `square-legacy` → Square SDK clients

### Step 4: Run tests

```bash
pnpm test:run
```

Expected: all new tests pass.

### Step 5: Coverage check

```bash
pnpm test:coverage
```

Expected: thresholds pass.

### Step 6: Typecheck

```bash
pnpm check
```

Expected: exit 0.

## Done criteria

- [ ] `pnpm test:run` exits 0
- [ ] `pnpm test:coverage` exits 0
- [ ] `pnpm check` exits 0
- [ ] Each handler has tests for the auth path, the error path, and the happy path
- [ ] No source files modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- A route handler cannot be imported in vitest without crashing (e.g. it
  imports Astro-specific APIs at module level) — report the import error; the
  handler may need a thin wrapper function extracted first.
- `isAdminAuthenticated` requires both `(request, cookies)` — mock it as
  `vi.fn().mockResolvedValue(true)` and pass a mock cookies object to the handler.
