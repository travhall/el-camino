# Plan 091: Delete or protect unauthenticated debug endpoints

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 915a062..HEAD -- src/pages/api/list-catalog.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: architecture / security
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`src/pages/api/list-catalog.ts` is an unauthenticated API endpoint that returns raw Square catalog data including pricing, inventory metadata, and product IDs. It has a commented-out `console.log`, indicating it was a debug tool, not a production feature. It is not linked from any page and has no callers in the codebase other than direct URL access.

Exposing raw catalog data without authentication:
- Leaks internal product metadata (Square IDs, variation structures)
- Provides a low-cost enumeration surface
- Is technical debt that will confuse future maintainers

## Current state

Read `src/pages/api/list-catalog.ts` fully. Confirm:
1. It has no authentication check (no session cookie validation, no `WARMUP_SECRET` check)
2. It is not imported or linked from any other file
3. No tests reference it

```bash
grep -r "list-catalog" src/ --include="*.ts" --include="*.astro" --include="*.tsx"
grep -r "list-catalog" e2e/
```

## Commands

| Purpose | Command | Expected |
|---------|---------|---------|
| Verify no callers | `grep -r "list-catalog" src/ e2e/` | no results |
| Typecheck | `pnpm check` | no errors |
| Tests | `pnpm test:run` | all pass |

## Scope

**In scope**: `src/pages/api/list-catalog.ts` — delete the file

**Out of scope**: everything else; do not add authentication to this endpoint, just delete it

## Git workflow

- Branch: `advisor/091-arch-delete-debug-endpoints`
- Commit: `chore: remove unauthenticated debug catalog endpoint`

## Steps

### Step 1: Verify no callers

```bash
grep -r "list-catalog" src/ e2e/ --include="*.ts" --include="*.astro" --include="*.spec.ts"
```

Expected: no output (zero callers). If any caller is found, STOP and report — do not delete.

### Step 2: Delete the file

Delete `src/pages/api/list-catalog.ts`.

### Step 3: Typecheck

```
pnpm check
```

Expected: no errors introduced.

### Step 4: Tests

```
pnpm test:run
```

Expected: all pass.

## Done criteria

- [ ] `src/pages/api/list-catalog.ts` does not exist
- [ ] No callers existed before deletion (confirmed by grep)
- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `plans/README.md` updated to DONE

## STOP conditions

- `grep` finds a caller — do not delete; report to user first
- The file contains authentication you missed — reassess; it may not be a debug endpoint

## Maintenance notes

If a new internal debug catalog view is needed in the future, add it under `/admin/` routes protected by `src/middleware.ts`.
