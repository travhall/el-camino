# Plan 115: Cache the computed back-in-stock product summaries

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8ff3096..HEAD -- src/lib/backInStock.ts`
> If this file changed since this plan was written, compare the "Current
> state" excerpt below against the live file before proceeding; on a
> mismatch, treat it as a STOP condition — this plan's approach depends on
> the exact write-path functions (`addSubscription`, `removeSubscription`,
> `removeAllSubscriptionsForProduct`) listed below still existing with
> their current signatures.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches the subscription write path — cache invalidation
  must stay consistent with the underlying Blob store, source of truth)
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `8ff3096`, 2026-08-06

## Why this matters

`src/lib/backInStock.ts`'s `getAllProductSummaries()` does `store().list()`
over the **entire** back-in-stock-subscriptions store, then issues one
`store().get(b.key, {type:'json'})` **per subscription blob returned**, all
in a single `Promise.all` fan-out, to reconstruct a per-product summary
(count + full subscriber list) for the admin dashboard:

```ts
export async function getAllProductSummaries(): Promise<ProductSummary[]> {
  const { blobs } = await store().list();
  const map = new Map<string, ProductSummary>();
  await Promise.all(
    blobs.map(async (b) => {
      const sub = (await store().get(b.key, { type: "json" })) as BisSubscription | null;
      ...
```

This is called on **every load** of `src/pages/admin/index.astro`
(dashboard summary counts) and `src/pages/admin/notifications/back-in-stock.astro`
(the full per-product subscriber listing, which genuinely needs each
subscriber's email and signup date rendered — confirmed by reading
`back-in-stock.astro:78`, `` {product.subscribers.map((sub, i) => ( `` —
so this is not simply a "count-only" dashboard tile that could skip
fetching subscriber details). The number of Blob GETs issued scales
linearly with total subscription volume across all products, on every
single admin page load, most of which are just someone checking the
dashboard — not adding or removing a subscription.

**Why the fix here is caching the computed result, not restructuring the
write path**: because the listing page genuinely renders full subscriber
detail per product, there's no way to serve it without reading every
subscription record *at least once per distinct render*. The
leverage is in not re-reading and re-aggregating on *every* admin page
load — most of which happen between subscription changes, not
concurrently with them. This codebase already has the exact tool for this:
`BlobCache.getOrCompute()`, used throughout `src/lib/wordpress/api.ts` and
elsewhere, which caches an expensive computation's *result* with a TTL,
falling back to recomputing (the current N+1 path) only on a cache miss.

An alternative — incrementally maintaining a pre-aggregated summary
document updated on every `addSubscription`/`removeSubscription` call —
was considered and rejected for this plan: it requires the aggregate to
stay perfectly consistent with the per-subscription source-of-truth
records across every write path (including `removeAllSubscriptionsForProduct`,
which bulk-deletes), which is meaningfully higher risk for a feature this
codebase's own subagent audit already judged low-traffic (back-in-stock
subscription volume for a small shop). A short-TTL cache of the computed
result gets nearly all of the latency benefit with far less risk.

## Current state

- `src/lib/backInStock.ts` (full file, 100 lines):
  ```ts
  // src/lib/backInStock.ts
  // Stores and retrieves back-in-stock email subscriptions using Netlify Blobs.
  // Each subscription is keyed by `{productId}/{email}` so we can efficiently
  // list all subscribers for a given product and delete individual entries
  // after notifications are sent.

  import { getStore } from "@netlify/blobs";

  export interface BisSubscription {
    email: string;
    productId: string;
    productTitle: string;
    variationId: string;
    productUrl: string;
    submittedAt: string;
  }

  function store() {
    return getStore({ name: "back-in-stock-subscriptions", consistency: "strong" });
  }

  function key(productId: string, email: string) {
    return `${productId}/${email.toLowerCase().trim()}`;
  }

  export async function addSubscription(sub: BisSubscription): Promise<void> {
    await store().setJSON(key(sub.productId, sub.email), sub);
  }

  export async function isAlreadySubscribed(
    productId: string,
    email: string
  ): Promise<boolean> {
    const existing = await store().get(key(productId, email));
    return existing !== null;
  }

  export async function getSubscriptionsForProduct(
    productId: string
  ): Promise<BisSubscription[]> {
    const { blobs } = await store().list({ prefix: `${productId}/` });
    const results = await Promise.all(
      blobs.map((b) =>
        store().get(b.key, { type: "json" }) as Promise<BisSubscription | null>
      )
    );
    return results.filter((s): s is BisSubscription => s !== null);
  }

  export async function removeSubscription(
    productId: string,
    email: string
  ): Promise<void> {
    await store().delete(key(productId, email));
  }

  export async function removeAllSubscriptionsForProduct(
    productId: string
  ): Promise<BisSubscription[]> {
    const { blobs } = await store().list({ prefix: `${productId}/` });
    const subs = (
      await Promise.all(
        blobs.map((b) => store().get(b.key, { type: "json" }) as Promise<BisSubscription | null>)
      )
    ).filter((s): s is BisSubscription => s !== null);
    await Promise.all(blobs.map((b) => store().delete(b.key)));
    return subs;
  }

  export interface ProductSummary {
    productId: string;
    productTitle: string;
    productUrl: string;
    count: number;
    subscribers: Array<{ email: string; submittedAt: string }>;
  }

  export async function getAllProductSummaries(): Promise<ProductSummary[]> {
    const { blobs } = await store().list();
    const map = new Map<string, ProductSummary>();

    await Promise.all(
      blobs.map(async (b) => {
        const sub = (await store().get(b.key, {
          type: "json",
        })) as BisSubscription | null;
        if (!sub) return;
        if (!map.has(sub.productId)) {
          map.set(sub.productId, {
            productId: sub.productId,
            productTitle: sub.productTitle,
            productUrl: sub.productUrl,
            count: 0,
            subscribers: [],
          });
        }
        const entry = map.get(sub.productId)!;
        entry.count++;
        entry.subscribers.push({ email: sub.email, submittedAt: sub.submittedAt });
      })
    );

    // Sort products by subscriber count descending; subscribers by signup date ascending
    const summaries = [...map.values()].sort((a, b) => b.count - a.count);
    summaries.forEach((s) =>
      s.subscribers.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    );
    return summaries;
  }
  ```
- Callers (unchanged by this plan — `getAllProductSummaries()`'s signature
  and return shape stay identical):
  - `src/pages/admin/index.astro:78` — `const summaries = await
    getAllProductSummaries();` then reduces to counts.
  - `src/pages/admin/notifications/back-in-stock.astro:15` —
    `summaries = await getAllProductSummaries();`, renders full
    `product.subscribers` list per product.
- `src/lib/cache/blobCache.ts`'s `BlobCache<T>` class — constructor
  `(name, ttlSeconds, storeName)`, method `getOrCompute(key, compute):
  Promise<T>` (around line 301) caches `compute()`'s result with the
  configured TTL, and a `delete(key)` method (around line 197) for
  invalidation. This is the same class already used for
  `wordpressCache` (`src/lib/cache/blobCache.ts:401`,
  `new BlobCache<any>('wordpress', 300)` — 5 min TTL) — match that
  established pattern/TTL choice here rather than inventing a new one.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|----------------------|
| Typecheck | `pnpm check`     | exit 0, "0 errors" |
| Tests     | `pnpm test:run -- backInStock` | all pass |
| Lint      | `pnpm lint`      | exit 0 |
| Build     | `pnpm build`     | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/lib/backInStock.ts`
- `src/lib/__tests__/backInStock.test.ts` (check exact path with
  `find src -iname "*backinstock*test*"` — add to whichever exists, or if
  none exists, add targeted tests for the new caching behavior only, not a
  full new suite for the whole module)

**Out of scope** (do NOT touch, even though they look related):
- `src/pages/admin/index.astro`, `src/pages/admin/notifications/back-in-stock.astro`
  — callers, unchanged signatures/shapes, no edit needed.
- `getSubscriptionsForProduct()` and `removeAllSubscriptionsForProduct()`'s
  own internal per-product `list()`+`Promise.all(get)` pattern — these are
  scoped to a *single* product's subscribers (bounded by realistic
  per-product subscriber counts, much smaller N than the all-products
  summary), not part of this finding, and not touched by this plan except
  for adding a cache-invalidation call where they mutate data (see Step 2).
- `src/lib/admin/dismissedOrders.ts` — the other half of the original
  combined finding, a separate, lower-risk fix in
  `plans/114-fix-dismissed-orders-blob-n-plus-1.md`. No code overlap.
- `src/lib/cache/blobCache.ts` — read-only reference for the `BlobCache`
  API; do not modify it.

## Git workflow

- Branch: `advisor/115-fix-backinstock-summaries-blob-n-plus-1`
- Commit message style: conventional commits, e.g. `perf: cache computed
  back-in-stock product summaries to avoid a full-store N+1 read on every
  admin page load` (matches `3417996 perf: cache fetchProducts in
  BlobCache, fix O(n²) scan, remove dead key` in `git log`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Wrap the summary computation in a short-TTL `BlobCache`

Add a module-level `BlobCache` instance and route `getAllProductSummaries`
through `getOrCompute`, moving the existing body into the compute callback
unchanged:

```ts
import { BlobCache } from "@/lib/cache/blobCache";

const summariesCache = new BlobCache<ProductSummary[]>(
  "bis-summaries",
  300, // 5 min — matches wordpressCache's TTL choice for a similar admin-facing aggregate
  "back-in-stock-summaries-cache"
);
const SUMMARIES_KEY = "all";

export async function getAllProductSummaries(): Promise<ProductSummary[]> {
  return summariesCache.getOrCompute(SUMMARIES_KEY, async () => {
    const { blobs } = await store().list();
    const map = new Map<string, ProductSummary>();

    await Promise.all(
      blobs.map(async (b) => {
        const sub = (await store().get(b.key, {
          type: "json",
        })) as BisSubscription | null;
        if (!sub) return;
        if (!map.has(sub.productId)) {
          map.set(sub.productId, {
            productId: sub.productId,
            productTitle: sub.productTitle,
            productUrl: sub.productUrl,
            count: 0,
            subscribers: [],
          });
        }
        const entry = map.get(sub.productId)!;
        entry.count++;
        entry.subscribers.push({ email: sub.email, submittedAt: sub.submittedAt });
      })
    );

    const summaries = [...map.values()].sort((a, b) => b.count - a.count);
    summaries.forEach((s) =>
      s.subscribers.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    );
    return summaries;
  });
}
```

Notes for the executor:
- `BlobCache`'s constructor's third argument (`storeName`) must be a
  **different** store name than `"back-in-stock-subscriptions"` (the raw
  subscription store) — use a distinct name like
  `"back-in-stock-summaries-cache"` as shown, so the cache blob doesn't
  collide with real subscription records in `store().list()`'s own
  `prefix`-less listing (which is exactly what `getAllProductSummaries`
  itself scans — a cache blob living in the *same* store would corrupt its
  own input).
- Use `getOrCompute`'s existing eventual-consistency/TTL semantics as-is —
  do not add a second custom caching layer on top.

**Verify**: `grep -n "summariesCache" src/lib/backInStock.ts` → 3+ matches (declaration + usage).

### Step 2: Invalidate the cache on every write path

Add `await summariesCache.delete(SUMMARIES_KEY);` to the end of each
function that mutates subscription data, so a stale cached summary never
outlives a real change by more than the rare case of a concurrent
in-flight read (acceptable — matches this codebase's existing
"eventual consistency" tradeoff used for `BlobCache` reads elsewhere, e.g.
`inventory.ts`'s Plan-060-documented eventual-consistency product reads):

- `addSubscription` — after the `setJSON` call.
- `removeSubscription` — after the `delete` call.
- `removeAllSubscriptionsForProduct` — after its bulk `Promise.all(blobs.map(delete))`.

Do **not** add invalidation to `isAlreadySubscribed` or
`getSubscriptionsForProduct` — neither mutates data.

**Verify**: `grep -c "summariesCache.delete" src/lib/backInStock.ts` → 3.

### Step 3: Confirm existing tests still pass, add cache-behavior coverage

Find the test file for this module (`find src -iname
"*backinstock*test*"`). If subscription-mutation tests currently assert on
`getAllProductSummaries()`'s output immediately after a call to
`addSubscription`/`removeSubscription` in the same test, those tests now
depend on the cache-invalidation added in Step 2 actually working — they
should still pass unmodified if Step 2 is correct, since invalidation
happens synchronously before the next `getAllProductSummaries()` call in
the same test. Add one new test explicitly asserting cache behavior: call
`getAllProductSummaries()` twice in a row without any mutation between the
calls, and assert the underlying `store().list()`/`store().get()` calls
(via a spy/mock) only happened once (proving the second call was served
from cache, not recomputed).

**Verify**: `pnpm test:run -- backInStock` → all pass, including the new
cache-behavior test.

## Test plan

- New test: two consecutive `getAllProductSummaries()` calls with no
  intervening mutation → underlying store `list`/`get` calls happen only
  once (cache hit on the second call).
- New test: `addSubscription()` (or `removeSubscription()`) followed by
  `getAllProductSummaries()` → reflects the change (proves invalidation
  actually busts the cache, not just that caching exists).
- Existing tests for `addSubscription`, `removeSubscription`,
  `removeAllSubscriptionsForProduct`, `isAlreadySubscribed`,
  `getSubscriptionsForProduct` should all still pass unmodified — none of
  these functions' own contracts change, only `getAllProductSummaries`
  gains caching and the three mutators gain an invalidation call.
- Verification: `pnpm test:run -- backInStock` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [x] `pnpm check` exits 0, "0 errors"
- [x] `pnpm test:run -- backInStock` exits 0, new tests passing
- [x] `pnpm lint` exits 0
- [x] `pnpm build` exits 0
- [x] `grep -c "summariesCache.delete" src/lib/backInStock.ts` → 3
- [x] No files outside the Scope list are modified (`git status`)
- [x] `plans/README.md` status row for 115 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `backInStock.ts` doesn't match the "Current state" excerpt (drift since
  this plan was written) — especially if the three mutator functions
  (`addSubscription`, `removeSubscription`,
  `removeAllSubscriptionsForProduct`) have different signatures or
  additional write paths not listed here; a missed invalidation site would
  leave stale cached data silently wrong for up to the TTL window.
- `BlobCache`'s constructor or `getOrCompute`/`delete` signatures don't
  match what Step 1/2 assume — read the actual current implementation in
  `blobCache.ts` before assuming the snippet compiles as written.
- You find a write path to the `"back-in-stock-subscriptions"` store this
  plan's excerpt didn't account for (e.g. a bulk-import script, a webhook
  handler) — search with `grep -rn "back-in-stock-subscriptions"
  src/` before concluding the three call sites listed above are the only
  writers; report back if a fourth is found rather than silently leaving
  it uninvalidated.

## Maintenance notes

- The cache TTL (5 minutes, matching `wordpressCache`) means a subscriber
  added/removed via a path this plan didn't anticipate (see STOP
  conditions above) would show stale data for up to 5 minutes rather than
  being permanently wrong — a deliberately bounded blast radius for this
  plan's main risk.
- If back-in-stock subscription volume grows enough that even the cached
  once-per-5-minutes recomputation becomes expensive, the
  incrementally-maintained-aggregate approach considered and rejected
  above (see "Why this matters") becomes worth revisiting — not needed at
  this shop's current scale.
- A reviewer should confirm all three mutator functions actually got the
  `summariesCache.delete(SUMMARIES_KEY)` call — a missed one is a silent,
  hard-to-notice staleness bug, not a crash, so it won't surface in normal
  testing unless the Step 3 cache-behavior tests specifically catch it.
