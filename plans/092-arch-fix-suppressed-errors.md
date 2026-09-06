# Plan 092: Replace suppressed errors and stray console calls with proper logging

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `grep -rn "catch.*{}" src/ --include="*.ts" --include="*.astro" | head -30`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: architecture
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

The audit found two classes of error-handling debt:

**ARCH-04**: Empty catch blocks silently swallow errors. When an uncaught exception occurs and the catch block does nothing, debugging becomes impossible — the failure is invisible in logs.

**Stray console.log/console.error calls**: `src/lib/square/apiUtils.ts` uses `console.error` in `logApiError`; `src/pages/api/list-catalog.ts` has a commented-out `console.log`. In a Netlify SSR context, `console.error` goes to function logs (acceptable for errors), but `console.log` in request paths creates log noise and can expose internal data.

## Current state

Run:
```bash
grep -rn "catch\s*(\w*)\s*{}" src/ --include="*.ts" --include="*.astro"
grep -rn "catch.*{\s*}" src/ --include="*.ts" --include="*.astro"
grep -rn "console\.log" src/ --include="*.ts" --include="*.astro"
```

to find the full scope before changing anything. List all instances, then fix in priority order:
1. Empty catch blocks that hide failures in critical paths (Square API calls, cart mutations)
2. `console.log` in non-debug code
3. Overly broad catch blocks that don't re-throw non-recoverable errors

## Commands

| Purpose | Command | Expected |
|---------|---------|---------|
| Typecheck | `pnpm check` | no errors |
| Tests | `pnpm test:run` | all pass |

## Scope

**In scope**: replacing empty catches and stray console calls in `src/`

**Out of scope**:
- `src/lib/square/apiUtils.ts` `logApiError` — `console.error` in an error logger is intentional; leave it
- Test files — console statements in tests are fine
- `.cache-bust` pattern: `.catch(() => {})` on cache writes is acceptable (non-critical path, already documented in plan 084)

## Git workflow

- Branch: `advisor/092-arch-fix-suppressed-errors`
- Commit: `refactor: replace empty catch blocks and stray console calls with proper error logging`

## Steps

### Step 1: Find all instances

```bash
grep -rn "console\.log" src/ --include="*.ts" --include="*.astro" | grep -v "node_modules"
grep -rn "catch\s*(.*)\s*{\s*}" src/ --include="*.ts" --include="*.astro" | grep -v "node_modules"
```

List them. Skip anything that:
- Is already a `.catch(() => {})` on a fire-and-forget cache write
- Is inside a test file
- Is `logApiError`

### Step 2: Fix stray console.log calls

For each `console.log` found that is not in a test file or debug tool: either remove the call (if it's old debug code) or replace with `console.error` if the intent was error logging.

### Step 3: Fix empty catch blocks in critical paths

For each empty `catch (e) {}` in a Square API call, cart operation, or checkout flow:
- If the caller already handles the failure: re-throw — `throw e`
- If the function should return a safe default: `console.error('Context message', e); return defaultValue`
- If it's a truly optional fire-and-forget side effect: leave it but add a comment explaining why

### Step 4: Typecheck and tests

```
pnpm check
pnpm test:run
```

## Done criteria

- [ ] No `console.log` in non-test `src/` files
- [ ] No empty catch blocks hiding Square API or cart failures
- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `plans/README.md` updated to DONE

## STOP conditions

- An empty catch block is in code you don't understand — read the surrounding context before changing it; some are intentional

## Maintenance notes

Future catch blocks should always log at minimum: `console.error('[context]', error)` with a location hint. Never silently swallow errors in payment or inventory flows.
