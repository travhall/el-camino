# Plan 081: Cache fetchProducts in BlobCache, fix O(n²) scan, remove dead cache key

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> ```
> git diff --stat 915a062..HEAD -- src/lib/square/client.ts src/pages/api/create-checkout.ts
> ```
> If either in-scope file changed, compare excerpts before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: performance
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

Three independent performance issues in the catalog fetch path, bundled because
they all touch `src/lib/square/client.ts` and two of them are causally linked.

**PERF-01 — fetchProducts bypasses BlobCache on every cold start**

`src/lib/square/client.ts:131` uses `requestDeduplicator.dedupe()` but NOT
`productCache.getOrCompute()`. Deduplication only prevents concurrent calls
within the same process — it does not cache across requests or process
restarts. Every cold Netlify function invocation paginating the full Square
catalog (potentially 20 API pages × 200 items) starts fresh. `productCache`
(a `BlobCache` instance exported from `src/lib/cache/blobCache.ts`) already
exists and is used by other functions; `fetchProducts` just doesn't call it.

**PERF-05 — O(n²) linear scan in product assembly**

`src/lib/square/client.ts:221-223`:

```typescript
const products = productsWithBasicInfo.map((p) => {
  const item = allObjects.find((obj) => obj.id === p.id);
```

`allObjects.find()` inside `.map()` is O(n²): for each product it scans the
entire raw objects array. For a 500-item catalog this is 250,000 comparisons
per call. The fix: build an `id → object` Map once before the map call.

**PERF-06 — dead cache-bust key in create-checkout.ts**

`src/pages/api/create-checkout.ts:495`:

```typescript
await productCache.delete("all-catalog-items-v3");
```

The key `"all-catalog-items-v3"` is never written anywhere in the codebase
(`productCache.set` or `productCache.getOrCompute` with that key). After
PERF-01 is fixed, `fetchProducts` will write under a different key (chosen in
Step 1 below). This line is a dead no-op and should be removed (or updated to
match the real key once PERF-01 is fixed).

## Current state

**PERF-01** — `src/lib/square/client.ts`, lines 131-135:

```typescript
export async function fetchProducts(): Promise<Product[]> {
  const cacheKey = "products:all";

  validateEnvironment();
  return requestDeduplicator.dedupe(cacheKey, () =>
    catalogRetryClient.executeWithRetry(async () => {
      // ... paginated Square API fetch ...
    })
  );
}
```

**PERF-05** — `src/lib/square/client.ts`, lines 220-224:

```typescript
const products = productsWithBasicInfo.map((p) => {
  // Get the item data for variations
  const item = allObjects.find((obj) => obj.id === p.id);
  const variations = item?.itemData?.variations || [];
```

**PERF-06** — `src/pages/api/create-checkout.ts`, line 495:

```typescript
await productCache.delete("all-catalog-items-v3");
```

Verify this key is indeed never written: `grep -r "all-catalog-items-v3" src/`
should return only this one line.

## Commands you will need

| Purpose   | Command              | Expected on success |
|-----------|----------------------|---------------------|
| Typecheck | `pnpm check`         | exit 0, no errors   |
| Tests     | `pnpm test:run`      | all pass            |
| Coverage  | `pnpm test:coverage` | all thresholds met  |

## Scope

**In scope**:
- `src/lib/square/client.ts`
- `src/pages/api/create-checkout.ts` (PERF-06 only — remove dead line)

**Out of scope**:
- `src/lib/cache/blobCache.ts` — `productCache` API is already correct; do not modify
- `src/pages/api/webhooks/square.ts` — webhook cache invalidation is separate;
  after PERF-01 is fixed, the webhook handler should also bust the new cache key
  (see Maintenance notes)

## Git workflow

- Branch: `advisor/081-perf-fetchproducts-cache-and-on2-fix`
- Commit: `perf: cache fetchProducts in BlobCache, fix O(n²) scan, remove dead key`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Wrap fetchProducts in productCache.getOrCompute (PERF-01)

In `src/lib/square/client.ts`, import `productCache` if not already imported:

```typescript
import { productCache } from "@/lib/cache/blobCache";
```

Then wrap the body of `fetchProducts` with `productCache.getOrCompute`:

```typescript
export async function fetchProducts(): Promise<Product[]> {
  const cacheKey = "products:all";

  validateEnvironment();
  return productCache.getOrCompute(cacheKey, () =>
    requestDeduplicator.dedupe(cacheKey, () =>
      catalogRetryClient.executeWithRetry(async () => {
        // ... existing paginated fetch unchanged ...
      })
    )
  );
}
```

The outer `productCache.getOrCompute` serves cached data across requests;
the inner `requestDeduplicator.dedupe` prevents concurrent cache-miss stampedes
within the same process.

Read `src/lib/cache/blobCache.ts` to confirm the `getOrCompute` signature
before using it — it should be `getOrCompute(key: string, fn: () => Promise<T>): Promise<T>`.

**Verify**: `pnpm check` → exit 0

### Step 2: Build a lookup Map before the inner map (PERF-05)

In `src/lib/square/client.ts`, immediately before the `.map((p) => {...})` at
line ~220, build an index:

```typescript
// Build an id-keyed Map so the inner .map() is O(1) per lookup, not O(n)
const allObjectsById = new Map(allObjects.map((obj) => [obj.id, obj]));

const products = productsWithBasicInfo.map((p) => {
  const item = allObjectsById.get(p.id);   // O(1) instead of O(n)
  const variations = item?.itemData?.variations || [];
  // ... rest unchanged ...
});
```

**Verify**: `pnpm check` → exit 0

### Step 3: Remove dead cache-bust key (PERF-06)

In `src/pages/api/create-checkout.ts`, find line 495:

```typescript
await productCache.delete("all-catalog-items-v3");
```

First confirm the key is never written:

```bash
grep -rn "all-catalog-items-v3" src/
```

Expected: only this one line. If true, delete the line entirely.

If PERF-01 has been completed (this plan), also ensure the webhook handler
at `src/pages/api/webhooks/square.ts` busts the `"products:all"` key when a
`catalog.version.updated` event arrives (see Maintenance notes). But do not
edit the webhook file in this plan — that is a separate change.

**Verify**: `pnpm check` → exit 0

### Step 4: Run tests and coverage

```
pnpm test:coverage
```

**Verify**: all thresholds met; no regressions from the three changes.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:coverage` exits 0
- [ ] `fetchProducts` calls `productCache.getOrCompute` before `requestDeduplicator.dedupe`
- [ ] The `allObjects.find()` inside `.map()` is replaced with a Map lookup
- [ ] The dead `productCache.delete("all-catalog-items-v3")` line is removed
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `productCache.getOrCompute` does not exist on the `BlobCache` type — check the API and use the correct method (`set`/`get` combo, or `getOrSet`)
- `"all-catalog-items-v3"` IS written somewhere that `grep` didn't find — do not delete the bust line until the writer is also updated
- Adding the BlobCache layer causes existing tests to fail due to missing mocks — add vitest mocks for `productCache` following the existing pattern in the test suite

## Maintenance notes

- **Webhook invalidation**: After PERF-01, `catalog.version.updated` should also
  call `productCache.delete("products:all")` inside `src/pages/api/webhooks/square.ts`
  (the `catalog.version.updated` case already busts per-product and category caches).
  This is a one-line addition to the webhook handler — worth doing in a follow-up
  PR or as an explicit step when reviewing the PR for this plan.
- The `allObjectsById` Map is built inside the `getOrCompute` closure, so it is
  per-call and does not persist. Memory use is bounded by catalog size (typically
  < 1MB for 500 items).
- The `products:all` cache key TTL comes from `productCache`'s constructor in
  `blobCache.ts` (15 minutes). If the catalog changes and the webhook invalidation
  (above) is in place, the new data will be served within one request cycle.
