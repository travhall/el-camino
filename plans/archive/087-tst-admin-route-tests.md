# Plan 087: Add unit tests for untested admin API routes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> ```
> git diff --stat 915a062..HEAD -- src/pages/api/admin/
> ```
> If admin routes changed significantly, read the live files before writing tests.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: test-coverage
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`src/pages/api/admin/` contains several route handlers with no test coverage.
Plan 070 added tests for some admin routes, but coverage gaps remain for:
- `mark-shipped.ts` — marks fulfillments as shipped
- `mark-pickedup.ts` — marks fulfillments as picked up
- `retry-failed-emails.ts` — replays failed webhook email deliveries
- `send-pickup-reminder.ts` — sends pickup reminders
- Other admin routes discovered in the directory

Without tests, admin operations that touch Square's Orders API (irreversible
state changes) have no regression protection.

## Current state

Run:

```bash
ls src/pages/api/admin/
```

and:

```bash
ls src/pages/api/__tests__/ | grep admin
```

to identify which admin routes exist and which already have tests. Write tests
only for the untested ones.

Pattern to follow: `src/pages/api/__tests__/admin-auth.test.ts` (existing
admin route test). Mocks Square API calls, calls the handler with a mock
`APIContext`, and asserts on the response status and body.

## Commands you will need

| Purpose   | Command                         | Expected on success |
|-----------|---------------------------------|---------------------|
| Tests     | `pnpm test:run -- admin`        | all pass            |
| Coverage  | `pnpm test:coverage`            | all thresholds met  |

## Scope

**In scope**:
- `src/pages/api/__tests__/` — new test files for each untested admin route

**Out of scope**:
- `src/pages/api/admin/*.ts` — tests only, no source changes
- Admin UI pages (`src/pages/admin/`) — not API routes

## Git workflow

- Branch: `advisor/087-tst-admin-route-tests`
- Commit: `test: add unit tests for untested admin API routes`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Identify untested admin routes

```bash
ls src/pages/api/admin/
ls src/pages/api/__tests__/ | grep admin
```

For each untested route, read the handler to understand what it does and what
needs to be mocked.

### Step 2: Write tests for mark-shipped.ts (if untested)

Read `src/pages/api/admin/mark-shipped.ts`. Write:
```typescript
// src/pages/api/__tests__/mark-shipped.test.ts
it('returns 401 when session cookie is invalid');
it('returns 400 when orderId is missing');
it('calls squareClient.orders.updateFulfillment with COMPLETED state');
it('returns 200 on success');
```

### Step 3: Write tests for retry-failed-emails.ts (if untested)

Read `src/pages/api/admin/retry-failed-emails.ts`. Write:
```typescript
it('returns 401 when unauthenticated');
it('calls sendOrderConfirmation for each stored failed email');
it('removes the failed email record on successful retry');
it('returns 200 with retry count');
```

### Step 4: Repeat for each remaining untested admin route

For each route found in Step 1 that lacks a test file:
1. Read the route handler
2. Write ≥ 3 tests: auth check, happy path, error path
3. Follow the mock pattern from `admin-auth.test.ts`

**Verify**: `pnpm test:run -- admin` → all pass

### Step 5: Run coverage

```
pnpm test:coverage
```

**Verify**: all thresholds met.

## Done criteria

- [ ] All admin routes in `src/pages/api/admin/` have at least one test file
- [ ] Each test file covers: auth rejection, happy path, at least one error path
- [ ] `pnpm test:run -- admin` exits 0
- [ ] `pnpm test:coverage` exits 0
- [ ] No source files are modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- A route makes live Square API calls in a way that can't be mocked — investigate the mock chain; do not skip the test

## Maintenance notes

- New admin routes should get a test file before merging.
- The auth check test (401 without cookie) is the cheapest and most important — always add it first.
