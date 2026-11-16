# Plan 114: Collapse per-order dismissed-orders Blob reads into a single lookup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8ff3096..HEAD -- src/lib/admin/dismissedOrders.ts src/pages/admin/orders/pickups.astro src/pages/admin/orders/shipping.astro src/pages/api/admin/dismiss-order.ts`
> If any of these changed since this plan was written, compare the "Current
> state" excerpts below against the live files before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `8ff3096`, 2026-08-06

## Why this matters

`src/lib/admin/dismissedOrders.ts`'s `filterDismissed()` issues one Netlify
Blob GET **per order** to check whether it's been dismissed:

```ts
export async function filterDismissed<T extends { orderId: string }>(
  orders: T[]
): Promise<T[]> {
  if (orders.length === 0) return [];
  const checks = await Promise.all(
    orders.map((o) =>
      store.get(o.orderId).then((v) => ({ order: o, keep: v !== true }))
    )
  );
  return checks.filter((c) => c.keep).map((c) => c.order);
}
```

This runs on **every load** of `src/pages/admin/orders/pickups.astro:91`
and `src/pages/admin/orders/shipping.astro:88`, both of which fetch orders
via `squareClient.orders.search()` with no explicit page-size `limit` —
so the number of Blob GETs issued scales directly with however many open
orders Square returns. Almost every one of these reads returns "not
dismissed" (the common case — dismissal is the exception, used for
sandbox/test orders or orders that can't be processed normally). This is
architecturally the same shape as the category-nav N+1 already fixed in
Plan 061, just against the Netlify Blobs API instead of the Square API:
latency grows linearly with the open-order backlog for no reason other
than checking a boolean per order.

The fix: store dismissed-order IDs as a single JSON array (or object-keyed
set) under **one** blob key, read once per page load, checked in-memory —
collapsing N GETs to 1.

## Current state

- `src/lib/admin/dismissedOrders.ts` (full file):
  ```ts
  // src/lib/admin/dismissedOrders.ts
  //
  // Tracks orders that have been manually dismissed from the admin pending lists.
  // Used to hide old test/sandbox orders or any order that can't be processed
  // normally through Square (e.g. orders with bad email addresses, locked orders).
  //
  // Dismissed orders are stored per-ID in Netlify Blobs with a 90-day TTL.
  // This does not modify Square — it only affects the admin UI.

  import { BlobCache } from "@/lib/cache/blobCache";

  const NINETY_DAYS = 60 * 60 * 24 * 90;

  const store = new BlobCache<true>(
    "admin-dismissed-orders",
    NINETY_DAYS,
    "dismissed"
  );

  export async function dismissOrder(orderId: string): Promise<void> {
    await store.set(orderId, true);
  }

  /** Returns a copy of `orders` with any dismissed entries removed. */
  export async function filterDismissed<T extends { orderId: string }>(
    orders: T[]
  ): Promise<T[]> {
    if (orders.length === 0) return [];
    const checks = await Promise.all(
      orders.map((o) =>
        store.get(o.orderId).then((v) => ({ order: o, keep: v !== true }))
      )
    );
    return checks.filter((c) => c.keep).map((c) => c.order);
  }
  ```
- Callers (do not change these files — the public function signatures
  `dismissOrder(orderId)` and `filterDismissed(orders)` stay identical, so
  no caller edit is needed):
  - `src/pages/admin/orders/shipping.astro:5,88` —
    `import { filterDismissed } from "@/lib/admin/dismissedOrders";` /
    `orders = await filterDismissed(orders);`
  - `src/pages/admin/orders/pickups.astro:5,91` — same pattern.
  - `src/pages/api/admin/dismiss-order.ts:9,27` —
    `import { dismissOrder } from "@/lib/admin/dismissedOrders";` /
    `await dismissOrder(orderId);`
  - Two existing test files mock this module:
    `src/pages/api/admin/__tests__/dismiss-order.test.ts` and
    `src/pages/api/__tests__/admin-dismiss-order.test.ts` (note: there
    appear to be two similarly-named test files for the same route —
    confirm both still pass after this change; do not consolidate them,
    that's out of scope).
- `src/lib/cache/blobCache.ts:18` — `export class BlobCache<T>` — its
  `get(key)`, `set(key, value)`, and `delete(key)` methods (around lines
  102, 154, 197) are the only API surface this plan needs; read their
  signatures before writing the new single-key storage shape (the generic
  `T` this plan will use is an array/set of order IDs, not `true` per key
  as today).

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|----------------------|
| Typecheck | `pnpm check`     | exit 0, "0 errors" |
| Tests     | `pnpm test:run -- dismiss-order` | all pass |
| Lint      | `pnpm lint`      | exit 0 |
| Build     | `pnpm build`     | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/lib/admin/dismissedOrders.ts`
- `src/pages/api/admin/__tests__/dismiss-order.test.ts`
- `src/pages/api/__tests__/admin-dismiss-order.test.ts`
(only if either file mocks `dismissedOrders.ts`'s internals in a way that
breaks after this change — if they only mock the exported function
signatures `dismissOrder`/`filterDismissed`, which are unchanged, no edit
should be needed; check first)

**Out of scope** (do NOT touch, even though they look related):
- `src/pages/admin/orders/pickups.astro`, `shipping.astro`,
  `src/pages/api/admin/dismiss-order.ts` — callers, unchanged signatures,
  no edit needed.
- `src/lib/backInStock.ts` — the second half of this finding
  (`getAllProductSummaries`'s per-subscription Blob reads), a separate,
  higher-risk fix covered by `plans/115-fix-backinstock-summaries-blob-n-plus-1.md`.
  Do not attempt both in one plan — they touch unrelated stores with
  different write-path complexity.
- `src/lib/cache/blobCache.ts` — read-only reference for the `BlobCache`
  API; do not modify it.
- The 90-day TTL policy — unchanged, just move where the data lives.

## Git workflow

- Branch: `advisor/114-fix-dismissed-orders-blob-n-plus-1`
- Commit message style: conventional commits, e.g. `perf: collapse
  per-order dismissed-orders Blob reads into a single lookup` (matches
  `3417996 perf: cache fetchProducts in BlobCache, fix O(n²) scan, remove
  dead key` in `git log`, a similarly-shaped prior perf fix).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Switch to a single-key array/set storage shape

Replace the per-order-ID storage with one blob holding a JSON array of
dismissed order IDs, under one fixed key (e.g. `"all"`):

```ts
import { BlobCache } from "@/lib/cache/blobCache";

const NINETY_DAYS = 60 * 60 * 24 * 90;

const store = new BlobCache<string[]>(
  "admin-dismissed-orders",
  NINETY_DAYS,
  "dismissed"
);

const DISMISSED_KEY = "all";

export async function dismissOrder(orderId: string): Promise<void> {
  const current = (await store.get(DISMISSED_KEY)) ?? [];
  if (!current.includes(orderId)) {
    await store.set(DISMISSED_KEY, [...current, orderId]);
  }
}

/** Returns a copy of `orders` with any dismissed entries removed. */
export async function filterDismissed<T extends { orderId: string }>(
  orders: T[]
): Promise<T[]> {
  if (orders.length === 0) return [];
  const dismissed = new Set((await store.get(DISMISSED_KEY)) ?? []);
  return orders.filter((o) => !dismissed.has(o.orderId));
}
```

Notes for the executor:
- This reduces `filterDismissed` from N GETs to 1, and `dismissOrder` from
  1 write to 1 read + 1 write (read-modify-write on the shared array) —
  still a net improvement since `dismissOrder` is a rare, deliberate admin
  action (clicking "dismiss" on one order at a time), not called in a loop,
  unlike `filterDismissed` which runs on every page load against every
  order in the list.
- Keep the exported function names and signatures (`dismissOrder`,
  `filterDismissed`) byte-identical — callers must not need changes.
- The 90-day TTL now applies to the single aggregate key instead of each
  per-order key — functionally equivalent for this use case (dismissals
  are rare and the list won't grow large enough for TTL granularity to
  matter; if this codebase's `BlobCache` TTL is a fixed-duration-from-write
  semantic, note that dismissing a new order refreshes the TTL for
  *all* previously-dismissed IDs too, not just the new one — check
  `BlobCache.set`'s TTL behavior before assuming this is a non-issue; if it
  resets the whole key's TTL on every write, that's an acceptable tradeoff
  here given the low write frequency and long 90-day window, not a
  regression worth blocking on).

**Verify**: `grep -n "DISMISSED_KEY" src/lib/admin/dismissedOrders.ts` → 3 matches (declaration + 2 uses).

### Step 2: Update or confirm the existing tests still pass

Read both existing test files
(`src/pages/api/admin/__tests__/dismiss-order.test.ts` and
`src/pages/api/__tests__/admin-dismiss-order.test.ts`). If they mock
`dismissedOrders.ts` only at the function-signature level (`vi.fn()` for
`dismissOrder`), no change is needed — the mock doesn't care about internal
storage shape. If either test reaches into the module's internals or
asserts on the old per-key storage pattern (unlikely given the exported
API is unchanged, but check), update it to match the new single-key shape.

**Verify**: `pnpm test:run -- dismiss-order` → all pass.

## Test plan

- No new test file is strictly required — the exported function contract
  (`dismissOrder(orderId): Promise<void>`, `filterDismissed(orders):
  Promise<T[]>`) is unchanged, and existing tests already exercise it
  through that contract per Step 2.
- If you judge it valuable, add a direct unit test for
  `dismissedOrders.ts` itself (check whether one already exists at
  `src/lib/admin/__tests__/dismissedOrders.test.ts` — if not, this is
  optional, not required for Done criteria) asserting: dismissing two
  orders then filtering a list containing both removes both in a single
  `store.get` call (mock `BlobCache`'s `get` and assert it was called
  exactly once during `filterDismissed`, not once per order).
- Verification: `pnpm test:run -- dismiss-order` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [x] `pnpm check` exits 0, "0 errors"
- [x] `pnpm test:run -- dismiss-order` exits 0
- [x] `pnpm lint` exits 0
- [x] `pnpm build` exits 0
- [x] `grep -n "orders.map" src/lib/admin/dismissedOrders.ts` → no matches
      (confirms the per-order `Promise.all(orders.map(...))` fan-out is
      gone)
- [x] No files outside the Scope list are modified (`git status`)
- [x] `plans/README.md` status row for 114 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `dismissedOrders.ts` doesn't match the "Current state" excerpt (drift
  since this plan was written).
- `BlobCache`'s `get`/`set` signatures don't match what Step 1 assumes
  (e.g. `set` requires additional options this plan's snippet omits) —
  read `blobCache.ts`'s actual method signatures before assuming the
  snippet compiles as-is; adjust to match the real API, but if the API
  shape makes a single-key array pattern awkward or impossible, report
  back rather than forcing it.
- Either existing test file has hard assertions on per-order-key storage
  that can't be reconciled with the new shape without changing what the
  test is actually verifying (as opposed to just how it mocks storage) —
  stop and report rather than weakening a real assertion.

## Maintenance notes

- If dismissed-order volume ever grows very large (thousands), a single
  JSON array blob has a practical size ceiling worth revisiting — not a
  concern at this shop's current/foreseeable order volume, but a future
  maintainer scaling this feature should know the tradeoff was made
  deliberately for the common case (small dismissal lists), not
  unconsidered.
- `plans/115-fix-backinstock-summaries-blob-n-plus-1.md` covers the
  second, unrelated half of the original finding (a similar N+1 pattern in
  `src/lib/backInStock.ts`) — no code overlap with this plan, safe to run
  in either order or in parallel.
