# Plan 133: Delete `BlobCache`'s unused `has()`/`getStats()`/`prune()` methods

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cdf74a3..HEAD -- src/lib/cache/blobCache.ts src/lib/cache/__tests__/blobCache.test.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `cdf74a3`, 2026-09-04

## Why this matters

`BlobCache` has three public methods — `has()`, `getStats()`, and `prune()`
— with zero callers anywhere in production code. Each is only exercised by
`blobCache.test.ts`, testing the class's own unused surface. `prune()` is
also a hardcoded no-op explicitly kept "for API compatibility with old Cache
class" — that old class no longer exists in this codebase, so the
compatibility reason is stale. Removing all three shrinks the class to the
methods its 9 exported cache instances (`inventoryCache`, `categoryCache`,
`productCache`, etc.) actually use, and removes tests that exist only to
cover dead surface.

## Current state

`src/lib/cache/blobCache.ts`, three methods:

```ts
  /**
   * Check if an entry exists and is not expired
   * @param key Cache key
   * @returns True if a valid entry exists
   */
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined;
  }
```
(lines 184-191, including its docstring)

```ts
  /**
   * Remove expired entries (not needed for Blobs - auto-expires)
   * Kept for API compatibility with old Cache class
   * Returns 0 immediately (sync) since Blobs handles expiration automatically
   */
  prune(): number {
    // Blobs handles expiration automatically via TTL metadata
    // No-op for compatibility - return 0 to indicate no entries pruned
    return 0;
  }
```
(lines 258-267, including its docstring)

```ts
  /**
   * Get cache statistics (simplified for Blobs)
   */
  getStats() {
    return {
      name: this.name,
      ttl: this.ttl,
      type: 'netlify-blobs',
      // Blobs doesn't provide size/count metrics easily
      size: 'N/A',
      count: 'N/A',
    };
  }
```
(lines 281-293, including its docstring)

Confirmed zero production callers via
`grep -rn "\.has(\|\.getStats(\|\.prune(" src --include="*.ts" --include="*.astro"`
excluding `blobCache.ts` and `__tests__` directories — every match found is
an unrelated `Map.has()`/`Set.has()`/`URLSearchParams.has()` call, never a
call on one of the 9 `BlobCache` instances exported at the bottom of the
file (`inventoryCache`, `categoryCache`, `productCache`, `imageCache`,
`wordpressCache`, `filterCache`, `navigationCache`, `slugCache`,
`measurementUnitCache`).

`src/lib/cache/__tests__/blobCache.test.ts` has tests that exist solely to
cover these three methods:

- Lines 112-132, `describe` block containing the `has()` tests
  ("should check if key exists" / "should return false for non-existent
  key") — both call `cache.has(...)` directly.
- Lines 443-458, the `describe('Cache Statistics', ...)` block — two tests
  calling `cache.getStats()`.
- Lines 460-466, the `describe('Prune Operation', ...)` block — one test
  calling `cache.prune()`.

## Commands you will need

| Purpose   | Command               | Expected on success |
|-----------|--------------------------|----------------------|
| Typecheck | `pnpm check`            | exit 0, no errors    |
| Tests     | `pnpm test:run`         | all pass             |
| Coverage  | `pnpm test:coverage`    | exit 0, thresholds met |
| Lint      | `pnpm lint`             | exit 0               |

## Scope

**In scope**:
- `src/lib/cache/blobCache.ts` — delete only the `has()`, `prune()`, and
  `getStats()` method bodies (with their docstrings).
- `src/lib/cache/__tests__/blobCache.test.ts` — delete only the test cases
  and `describe` blocks that exist solely to cover those three methods.

**Out of scope**:
- Every other `BlobCache` method (`get`, `set`, `delete`, `clear`,
  `cleanupFallbackCache`, `destroy`, `getOrCompute`) and their tests — all
  have real production callers, do not touch them.
- The 9 exported cache instances at the bottom of `blobCache.ts` (lines
  393-413) — unrelated to this plan, do not touch.
- Any file outside the two listed above — nothing else references `has()`,
  `getStats()`, or `prune()` on a `BlobCache` instance.

## Git workflow

- Branch: `advisor/133-delete-unused-blobcache-methods`
- Single commit.
- Commit message style: lowercase, conventional-ish prefix, e.g.
  `chore: remove BlobCache's unused has/getStats/prune methods`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Delete the three unused methods from `blobCache.ts`

Delete the `has()` method (lines 184-191 including its docstring), the
`prune()` method (lines 258-267 including its docstring), and the
`getStats()` method (lines 281-293 including its docstring) from
`src/lib/cache/blobCache.ts`. Leave every surrounding method (`get`, `set`,
`delete`, `clear`, `cleanupFallbackCache`, `destroy`, `getOrCompute`)
untouched — only remove the three named blocks.

**Verify**: `grep -n "  has(\|  prune(\|  getStats(" src/lib/cache/blobCache.ts` →
no matches (the class no longer declares these methods).

### Step 2: Delete the corresponding tests

In `src/lib/cache/__tests__/blobCache.test.ts`:
1. Delete the two `it()` blocks inside the `describe` that calls
   `cache.has(...)` (around lines 112-132 — "should check if key exists" and
   "should return false for non-existent key"). If those two tests are the
   only content of their enclosing `describe` block, delete the `describe`
   wrapper too; if the `describe` block also contains unrelated tests
   (e.g. for `delete()`), keep the block and only remove the two `has()`
   tests.
2. Delete the entire `describe('Cache Statistics', ...)` block (around lines
   443-458).
3. Delete the entire `describe('Prune Operation', ...)` block (around lines
   460-466).

**Verify**: `grep -n "\.has(\|\.getStats(\|\.prune(" src/lib/cache/__tests__/blobCache.test.ts` →
no matches (note: this file's `fallbackCache.has(...)` assertions, if any
exist elsewhere testing the internal `Map`, are a different thing — re-check
against the live file before assuming a match is safe to delete; the plan's
line numbers above are the only intended targets).

## Test plan

No new tests — this plan only removes tests for now-deleted methods. The
rest of `blobCache.test.ts` (covering `get`/`set`/`delete`/`clear`/
`cleanupFallbackCache`/`getOrCompute`) is unaffected and must continue
passing unchanged.

- Verification: `pnpm test:run` → passes, with exactly 5 fewer test cases
  than the pre-change baseline (2 from `has()`, 2 from `getStats()`, 1 from
  `prune()`).
- Verification: `pnpm test:coverage` → `src/lib/cache/blobCache.ts` coverage
  is unaffected or improves (fewer uncovered branches now that dead-surface
  methods are gone); no threshold regression.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `pnpm test:coverage` exits 0, no threshold regression
- [ ] `grep -n "  has(\|  prune(\|  getStats(" src/lib/cache/blobCache.ts` returns no matches
- [ ] `grep -n "cache.has(\|cache.getStats(\|cache.prune(" src/lib/cache/__tests__/blobCache.test.ts` returns no matches
- [ ] Only the two in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The live `blobCache.ts`/`blobCache.test.ts` excerpts don't match "Current
  state" (drift).
- `grep -rn "\.has(\|\.getStats(\|\.prune(" src` (repo-wide, excluding this
  plan's two in-scope files) turns up a call on any of the 9 exported
  `BlobCache` instances that this plan's original recon missed — do not
  delete the corresponding method if a real caller exists; report back
  instead.
- Deleting a `describe` block in Step 2 would also remove test cases for a
  method this plan didn't intend to touch (i.e. the block isn't purely about
  `has`/`getStats`/`prune`) — split the block instead of deleting it whole.

## Maintenance notes

- If a future feature needs to check cache existence without reading the
  value, or needs cache introspection for an admin/debug view, `has()`/
  `getStats()` are simple one-liners to re-add at that point — this deletion
  isn't foreclosing anything, just removing speculative API surface nobody
  currently uses.
- `prune()`'s docstring referenced an "old Cache class" that no longer
  exists in this codebase — if a reviewer wants to trace that history, it
  predates the current `BlobCache` (Netlify Blobs) implementation.
