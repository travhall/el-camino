# Plan 048: Delete deprecated cacheUtils.ts re-export shim

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/lib/square/cacheUtils.ts src/lib/square/categories.ts`
> If any changes appear, compare the "Current state" excerpts before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

`src/lib/square/cacheUtils.ts` is self-marked `@deprecated` — it's a pure
re-export shim that exists solely to forward `BlobCache` exports from
`src/lib/cache/blobCache.ts`. The intent was to migrate callers to import from
`blobCache.ts` directly; the migration is incomplete. `categories.ts` still
imports through the shim. The shim keeps a confusing file alive, and the
`@deprecated` annotation signals intent that was never finished.

## Current state

**`src/lib/square/cacheUtils.ts`** (entire file):
```typescript
// src/lib/square/cacheUtils.ts
/**
 * @deprecated Use BlobCache from ../cache/blobCache.ts for serverless persistence
 */
export { inventoryCache, productCache, categoryCache, /* etc */ } from "../cache/blobCache";
```

**`src/lib/square/categories.ts:11`**:
```typescript
import { categoryCache, productCache } from "./cacheUtils";
```

Other potential importers:
```bash
grep -rn "from.*cacheUtils" src/
```

## Commands you will need

| Purpose   | Command              | Expected on success       |
|-----------|----------------------|---------------------------|
| Typecheck | `pnpm check`         | exit 0, no errors         |
| Unit tests | `pnpm test:run`     | all pass                  |

## Scope

**In scope**:
- `src/lib/square/cacheUtils.ts` — delete this file
- `src/lib/square/categories.ts` — update import path
- Any other file found to import from `cacheUtils` (Step 1)

**Out of scope**:
- `src/lib/cache/blobCache.ts` — do not modify
- Any test that mocks `cacheUtils` (update the mock path instead)

## Git workflow

- Branch: `advisor/048-delete-cacheutils-shim`
- Commit message: `refactor: remove deprecated cacheUtils.ts shim, import from blobCache directly`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Find all importers of cacheUtils

```bash
grep -rn "from.*cacheUtils\|require.*cacheUtils" src/
```

List every file found. All of them need their import updated.

### Step 2: Update each importer to import from blobCache directly

For `src/lib/square/categories.ts`, change:
```typescript
import { categoryCache, productCache } from "./cacheUtils";
```
to:
```typescript
import { categoryCache, productCache } from "@/lib/cache/blobCache";
```

Apply the same pattern to every other file found in Step 1, using the correct
relative path to `src/lib/cache/blobCache.ts` from each file's location.

**Verify**: `grep -rn "from.*cacheUtils" src/` → no matches.

### Step 3: Delete cacheUtils.ts

```bash
rm src/lib/square/cacheUtils.ts
```

**Verify**: `ls src/lib/square/cacheUtils.ts` → "No such file or directory".

### Step 4: Typecheck and test

```bash
pnpm check
```
Expected: exit 0. If any errors reference `cacheUtils`, a caller was missed
in Step 1 — fix it.

```bash
pnpm test:run
```
Expected: all pass. If any test file mocks `"@/lib/square/cacheUtils"`, update
the mock path to `"@/lib/cache/blobCache"`.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `ls src/lib/square/cacheUtils.ts` → file does not exist
- [ ] `grep -rn "cacheUtils" src/` → no matches
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- An importer is in a file outside `src/lib/square/` (e.g. a page or test)
  and the path adjustment is non-trivial — note the file and report.
- `pnpm check` errors with "cannot find module blobCache" — confirm the path
  alias `@/lib/cache/blobCache` resolves in `tsconfig.json`.
