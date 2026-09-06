# Plan 049: Replace console.log/info calls in lib layer with logger

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/lib/logger.ts src/lib/cache/blobCache.ts src/lib/square/`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

`src/lib/logger.ts` silences debug/info logs in production to avoid flooding
Netlify's log budget and obscuring real errors. But the hot-path lib files
(`blobCache.ts`, `slugResolver.ts`, `apiRetry.ts`, `filterUtils.ts`, `client.ts`)
bypass the logger with direct `console.log`/`console.info` calls, making the
logger's entire purpose moot. Every cold-start, every slug-map rebuild, and
every circuit-breaker state change emits a console.log in production.

The fix is a sweep: replace `console.log` → `logger.debug` and `console.info`
→ `logger.info` across `src/lib/`. `console.warn` and `console.error` are
already aligned — leave them alone.

## Current state

**`src/lib/logger.ts`** — exports `logger` with `.debug/.info/.warn/.error`:
```typescript
// logger silences debug/info in production:
// process.env.NODE_ENV === 'production' → debug/info are no-ops
export const logger = { ... };
```

Confirmed `console.log/info` callers in `src/lib/`:
- `src/lib/cache/blobCache.ts:45,57,249`
- `src/lib/square/apiRetry.ts:152`
- `src/lib/square/slugResolver.ts:52,72,88`
- `src/lib/square/filterUtils.ts:165`

Run the full grep to get the complete list before starting:
```bash
grep -rn "console\.log\|console\.info" src/lib/
```

## Commands you will need

| Purpose   | Command              | Expected on success       |
|-----------|----------------------|---------------------------|
| Typecheck | `pnpm check`         | exit 0, no errors         |
| Unit tests | `pnpm test:run`     | all pass                  |

## Scope

**In scope**: all files in `src/lib/` only

**Out of scope**:
- `src/pages/` — page-level console calls are acceptable; do not change
- `src/components/` — client scripts may legitimately use console
- `src/scripts/` — dev utilities; don't touch
- `console.warn` and `console.error` — already appropriate; do not replace

## Git workflow

- Branch: `advisor/049-logger-adoption-sweep`
- Commit message: `refactor: replace console.log/info with logger in src/lib/`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Generate the full list of console.log/info in src/lib/

```bash
grep -rn "console\.log\|console\.info" src/lib/
```

Record every file:line. This is your work list. Do NOT proceed without this list.

### Step 2: Add logger import to each affected file and replace calls

For each file in the work list:

1. Check if `import { logger } from "@/lib/logger"` is already at the top.
   If not, add it.

2. Replace every `console.log(...)` with `logger.debug(...)`.

3. Replace every `console.info(...)` with `logger.info(...)`.

Do NOT change `console.warn(...)` or `console.error(...)`.

The logger API matches the console API — arguments are identical.

**Verify after each file**: `grep -n "console\.log\|console\.info" <file>` → no matches.

### Step 3: Confirm no console.log/info remain in src/lib/

```bash
grep -rn "console\.log\|console\.info" src/lib/
```
Expected: no output.

### Step 4: Typecheck and test

```bash
pnpm check
```
Expected: exit 0.

```bash
pnpm test:run
```
Expected: all pass. Tests that spy on `console.log` may need to switch to
spying on `logger.debug` instead — check test output and update if needed.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep -rn "console\.log\|console\.info" src/lib/` → no output
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- A test spies on `console.log` from a lib module and the spy breaks after
  the change — update the spy to `vi.spyOn(logger, "debug")` instead.
- `logger.ts` is not in `src/lib/` (confirm path before adding imports).

## Maintenance notes

- Enforce going forward: if ESLint is added (see DX plans), add the `no-console`
  rule scoped to `src/lib/**` to prevent recurrence.
- `console.error` in lib files is intentional (errors should always appear
  in logs); do not add a lint rule that blocks it.
