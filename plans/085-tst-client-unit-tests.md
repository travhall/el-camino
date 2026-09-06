# Plan 085: Add unit tests for src/lib/square/client.ts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 915a062..HEAD -- src/lib/square/client.ts`
> If the file changed significantly, read it fully before writing tests.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (read-only test changes)
- **Category**: test-coverage
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`src/lib/square/client.ts` is the largest file in `src/lib/square/` and the
primary interface to the Square catalog. It exports `fetchProducts`,
`fetchProduct`, `batchGetImageUrls`, and several utility functions. Despite
being the most-used catalog layer, it has zero unit tests. The file has no
test file at `src/lib/square/__tests__/client.test.ts`.

A cold-start regression in `fetchProducts` (wrong deduplication, broken cache
key, mapping error) or a buggy `fetchProduct` path would silently break every
product page. Tests make refactoring safe and confirm the PERF-01 BlobCache
integration (plan 081) works correctly.

## Current state

No test file exists at `src/lib/square/__tests__/client.test.ts`. Run:

```bash
ls src/lib/square/__tests__/
```

and confirm `client.test.ts` is absent.

The existing test files in that directory (e.g. `inventory.test.ts`,
`apiRetry.test.ts`) show the pattern: `vi.mock('square-legacy')`, mock the
`squareClient`, and test the exported functions. Follow that pattern.

Key exports to test: `fetchProducts`, `fetchProduct`, `batchGetImageUrls`.

## Commands you will need

| Purpose   | Command                         | Expected on success |
|-----------|---------------------------------|---------------------|
| Tests     | `pnpm test:run -- client`       | all pass            |
| Coverage  | `pnpm test:coverage`            | all thresholds met  |

## Scope

**In scope**:
- `src/lib/square/__tests__/client.test.ts` (new file)

**Out of scope**:
- `src/lib/square/client.ts` — tests only, no source changes
- Any other lib or page file

## Git workflow

- Branch: `advisor/085-tst-client-unit-tests`
- Commit: `test: add unit tests for src/lib/square/client.ts`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read client.ts exports and patterns

Read `src/lib/square/client.ts` fully to understand:
- What `fetchProducts` does (paginated catalog fetch + image enrichment)
- What `fetchProduct` does (single product by ID)
- What mocks are needed (`squareClient`, `productCache`, `requestDeduplicator`)

Also read `src/lib/square/__tests__/inventory.test.ts` to see the existing
mock setup pattern.

### Step 2: Create the test file

Create `src/lib/square/__tests__/client.test.ts` with at minimum these test
cases:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
// import the functions under test

// Mock square-legacy
vi.mock('square-legacy', () => ({ /* ... */ }));
// Mock productCache
vi.mock('@/lib/cache/blobCache', () => ({ productCache: { getOrCompute: vi.fn(), delete: vi.fn() } }));

describe('fetchProducts', () => {
  it('returns an empty array when catalog has no ITEM type objects');
  it('maps catalog objects to Product shape (id, title, price, variationId)');
  it('paginates through all pages until cursor is undefined');
  it('deduplicates concurrent calls via requestDeduplicator');
  // If plan 081 is landed: it('returns cached result from productCache on second call');
});

describe('fetchProduct', () => {
  it('returns null when product ID is not found');
  it('returns a Product when the Square API returns a matching object');
  it('enriches image URL via batchGetImageUrls');
});
```

Fill in the test bodies following the pattern in `inventory.test.ts`.

**Verify**: `pnpm test:run -- client` → all written tests pass

### Step 3: Run coverage

```
pnpm test:coverage
```

**Verify**: global coverage thresholds met; new test file does not drag any
existing thresholds below their minimums.

## Done criteria

- [ ] `src/lib/square/__tests__/client.test.ts` exists
- [ ] At least 6 test cases covering `fetchProducts` and `fetchProduct`
- [ ] `pnpm test:run -- client` exits 0
- [ ] `pnpm test:coverage` exits 0
- [ ] `src/lib/square/client.ts` is not modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `fetchProducts` makes real Square API calls in test without a mock — investigate the mock chain before writing; every Square API call must be intercepted
- `client.ts` was restructured by plan 081 or another plan — read the live file first

## Maintenance notes

- When plan 081 lands (BlobCache wrapping), add a test that the cache key is hit on second call and `squareClient.catalog.list` is NOT called again.
- Each new export added to `client.ts` should get a corresponding test in this file.
