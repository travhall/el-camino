# Plan 140: Add unit tests for `categoryLookup.ts`'s retry/cache-invalidation logic

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cdf74a3..HEAD -- src/lib/square/categoryLookup.ts`
> If the file changed since this plan was written, compare the "Current
> state" excerpt against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: test-coverage
- **Planned at**: commit `cdf74a3`, 2026-09-04

## Why this matters

`src/lib/square/categoryLookup.ts` (199 lines, 0% test coverage — confirmed
via `find src/lib/square/__tests__ -iname "*categoryLookup*"` returning
nothing) implements the retry-with-cache-invalidation pattern that handles
Netlify Blobs' eventual consistency for category-page lookups. Its sole
caller is `src/pages/category/[...slug].astro`, meaning **every category
page render** goes through `resolveCategoryPathWithRetry` untested. This is
the same class of bug (Blob eventual consistency) that
`plans/060-blobcache-eventual-consistency.md` previously had to fix
elsewhere in the codebase — an untested retry/backoff path here means a
similar regression on the category-page route wouldn't be caught before
shipping.

## Current state

`src/lib/square/categoryLookup.ts` (full file, 199 lines):

- `invalidateCategoryCache(slug?: string): Promise<void>` (lines 11-19,
  private/unexported) — deletes `category-by-slug:${slug}` (if `slug`
  given), plus always deletes `nav-hierarchy` and `hierarchy-with-products`
  from `categoryCache`.
- `getCategoryBySlug(slug): Promise<Category | null>` (lines 28-64,
  exported) — wraps a `categoryCache.getOrCompute` call (itself wrapped in
  `requestDeduplicator.dedupe`) that dynamically imports
  `fetchCategoryHierarchy` from `./categories` and linear-searches top-level
  categories, then subcategories, for a matching `slug`.
- `getCategoryWithSubcategories(categoryId): Promise<CategoryHierarchy | null>`
  (lines 71-97, exported) — similar `getOrCompute`-wrapped hierarchy search
  by `id` instead of `slug`.
- `resolveCategoryPath(slugPath): Promise<{category, parentCategory, subcategories}>`
  (lines 106-149, exported) — splits `slugPath` on `/`; single-segment paths
  call `getCategoryBySlug` + `getCategoryWithSubcategories`; two-segment
  paths (`parent/child`) call `getCategoryBySlug` twice in parallel via
  `Promise.all` and return the child with empty `subcategories`.
- **`resolveCategoryPathWithRetry(slugPath, maxRetries = 2)`** (lines
  159-199, exported) — the retry loop this plan focuses on:
  ```ts
  export async function resolveCategoryPathWithRetry(
    slugPath: string,
    maxRetries: number = 2
  ): Promise<{...}> {
    let attempt = 0;
    while (attempt <= maxRetries) {
      const result = await resolveCategoryPath(slugPath);
      if (result.category) {
        return result; // success, possibly after retries
      }
      if (attempt === maxRetries) {
        return result; // exhausted, give up
      }
      attempt++;
      const slugParts = slugPath.split('/');
      await Promise.all(slugParts.map((slug) => invalidateCategoryCache(slug)));
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
    return { category: null, parentCategory: null, subcategories: [] };
  }
  ```

Exemplar mocking pattern already established in this repo for the exact
same dependencies:
`src/lib/square/__tests__/categoryNav.test.ts:47-56,58-62,78-80` mocks
`@/lib/cache/blobCache`'s `categoryCache` (with `get`/`set`/`getOrCompute`
mock functions), `../requestDeduplication`'s `requestDeduplicator` (with a
`dedupe` mock), and `./categories`'s `fetchCategoryHierarchy` — the same
three modules `categoryLookup.ts` depends on. Follow that file's `vi.mock`
structure directly.

## Commands you will need

| Purpose   | Command                                          | Expected on success |
|-----------|-------------------------------------------------------|----------------------|
| Typecheck | `pnpm check`                                        | exit 0, no errors    |
| Tests     | `pnpm test:run -- categoryLookup`                  | all pass             |
| Coverage  | `pnpm test:coverage`                                 | exit 0, thresholds met |

## Scope

**In scope**:
- New file: `src/lib/square/__tests__/categoryLookup.test.ts`

**Out of scope**:
- `src/lib/square/categoryLookup.ts` itself — tests only, no source changes.
  If a test reveals what looks like a real bug, report it and stop rather
  than silently fixing source or writing the test to match buggy behavior.
- `src/lib/square/categoryNav.ts`, `src/lib/square/categories.ts` — used as
  a mocking exemplar and a mocked dependency respectively, not modified.

## Git workflow

- Branch: `advisor/140-test-categorylookup-retry`
- Single commit.
- Commit message style: lowercase, conventional-ish prefix, e.g.
  `test: add coverage for categoryLookup.ts's retry/invalidation logic`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Set up the test file's mocks

Create `src/lib/square/__tests__/categoryLookup.test.ts`. Mock, following
`categoryNav.test.ts`'s exact structure:
- `@/lib/cache/blobCache` — `categoryCache` with `getOrCompute` (mock
  implementation: call the passed-in compute function and return its
  result, i.e. treat it as a cache-miss-always pass-through for simplicity)
  and `delete` (a `vi.fn()`, since `invalidateCategoryCache` calls
  `categoryCache.delete(...)`, not `.get`/`.set`).
- `../requestDeduplication` — `requestDeduplicator` with `dedupe` (mock
  implementation: just call and return the passed-in function's result,
  bypassing real dedup logic — since this plan is testing
  `categoryLookup.ts`'s own logic, not the dedup mechanism itself).
- `./categories` — `fetchCategoryHierarchy` returning a fixture hierarchy
  (see Step 2).
- Use `vi.useFakeTimers()` / `vi.advanceTimersByTimeAsync(...)` (or
  equivalent) to avoid the real `100 * attempt` ms delays in
  `resolveCategoryPathWithRetry` slowing down the test suite — check how
  other retry-testing files in this repo handle fake timers (e.g.
  `src/lib/square/__tests__/apiRetry.test.ts` already exercises retry
  delays; follow its fake-timer setup/teardown pattern in `beforeEach`/
  `afterEach`).

**Verify**: file compiles (`pnpm check` includes test files).

### Step 2: Define a fixture category hierarchy

Define a small, reusable fixture matching the `Category`/`CategoryHierarchy`
shape from `@/lib/square/types` — e.g. one top-level category `"decks"`
with one subcategory `"mini-cruisers"`, and a second top-level category
`"trucks"` with no subcategories. Use this fixture as
`fetchCategoryHierarchy`'s mocked resolved value across the test cases
below (adjust per-test via `mockFetchCategoryHierarchy.mockResolvedValueOnce`
where a test needs different data, e.g. simulating "not found yet, found on
retry").

### Step 3: Test `resolveCategoryPathWithRetry`'s success-on-first-try path

- Given `fetchCategoryHierarchy` resolves with the fixture (Step 2)
  containing `"decks"`, calling `resolveCategoryPathWithRetry("decks")`
  resolves with `category.slug === "decks"` and does NOT call
  `categoryCache.delete` (no invalidation needed — found immediately).

**Verify**: assertion passes; `categoryCache.delete` call count is 0.

### Step 4: Test the retry-after-cache-invalidation path

- Given `getCategoryBySlug`'s underlying `getOrCompute`/hierarchy lookup
  returns "not found" on the first call and "found" on the second (mock
  `fetchCategoryHierarchy` — or more directly, mock `categoryCache.getOrCompute`
  itself — to return a hierarchy without the target slug on the first
  invocation and with it on the second), calling
  `resolveCategoryPathWithRetry("decks", 2)` eventually resolves with
  `category.slug === "decks"`.
- Assert `categoryCache.delete` was called for the invalidation keys this
  plan's "Current state" documents (`category-by-slug:decks`,
  `nav-hierarchy`, `hierarchy-with-products`) at least once between the
  failed first attempt and the successful retry.

**Verify**: assertion passes; `categoryCache.delete` called with the
expected keys.

### Step 5: Test the exhausted-retries path

- Given every attempt returns "not found" (hierarchy never contains the
  target slug), calling `resolveCategoryPathWithRetry("nonexistent-slug", 2)`
  resolves with `category: null` after exactly `maxRetries + 1` (3) total
  lookup attempts — assert the mocked lookup function was called exactly 3
  times, not more, not fewer (proves the loop terminates correctly instead
  of retrying forever or giving up early).

**Verify**: assertion passes; call count is exactly 3.

### Step 6: Test the nested-slug-path invalidation fan-out

- Calling `resolveCategoryPathWithRetry("trucks/mini-cruisers")` (a
  two-segment path) on a retry path should invalidate the cache for
  **both** slug parts (`trucks` and `mini-cruisers`), not just one — assert
  `categoryCache.delete` was called with `category-by-slug:trucks` AND
  `category-by-slug:mini-cruisers` (plus the two always-invalidated keys)
  when a retry occurs on a nested path.

**Verify**: assertion passes.

## Test plan

This entire plan *is* the test plan — see Steps 3-6 above for the exact
cases. Model the file's mocking setup directly on
`src/lib/square/__tests__/categoryNav.test.ts`'s `vi.mock` blocks, and its
fake-timer handling on `src/lib/square/__tests__/apiRetry.test.ts`'s retry
tests.

- Verification: `pnpm test:run -- categoryLookup` → all new cases pass.
- Verification: `pnpm test:coverage` → `src/lib/square/categoryLookup.ts`
  coverage rises substantially from its current 0% baseline; no repo-wide
  threshold regression.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run -- categoryLookup` exits 0, with test cases for:
      success-on-first-try, retry-after-invalidation, exhausted-retries,
      and nested-slug-path invalidation fan-out
- [ ] `pnpm test:coverage` exits 0, no threshold regression;
      `categoryLookup.ts` coverage measurably above 0%
- [ ] Only `src/lib/square/__tests__/categoryLookup.test.ts` created
      (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The live `categoryLookup.ts` doesn't match "Current state" (drift).
- A test reveals the retry loop doesn't actually terminate at
  `maxRetries + 1` attempts, or doesn't invalidate the cache keys the
  source code appears to target — report the discrepancy rather than
  adjusting the test to match unexpected behavior.
- `vi.mock('@/lib/cache/blobCache', ...)` conflicts with how
  `categoryLookup.ts` imports `categoryCache` (e.g. a default vs. named
  export mismatch) — double-check the exact import statement
  (`import { categoryCache } from '@/lib/cache/blobCache';`, confirmed at
  `categoryLookup.ts:3`) before assuming the exemplar mock transfers
  directly.

## Maintenance notes

- If `resolveCategoryPathWithRetry`'s retry count or delay formula changes
  in the future, update Step 5's "exactly 3 calls" and Step 4's delay
  assertions accordingly — they're pinned to the current
  `maxRetries: number = 2` default and `100 * attempt` ms formula.
- This test file uses fake timers to avoid real `setTimeout` delays slowing
  the suite — if a future change to this file removes the delay entirely
  (e.g. switches to immediate retry), the fake-timer scaffolding here can be
  simplified/removed.
