# Plan 166: Make cache writes durable and inventory invalidation visible across instances

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report. When done, update this plan's status row
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/lib/cache/blobCache.ts src/lib/square/inventoryCore.ts src/pages/api/webhooks/square.ts`
> On any change, compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

Two defects combine into the most likely real-world oversell path.

**1. Invalidation only reaches one function instance.** `BlobCache.delete()`
clears `this.fallbackCache` — the in-memory tier of *whichever* Netlify instance
handled that request — then deletes the blob. But `get()` and `getOrCompute()`
both check `fallbackCache` **first** and return early on a hit. So every other
warm instance keeps serving its own stale copy until its TTL expires, never
reaching the blob layer to notice the delete.

`inventoryCache`'s TTL is **900 s**. The Square `inventory.count.updated`
webhook's only action is `inventoryCache.delete(id)`. So the webhook-driven
invalidation the system is designed around is largely ineffective fleet-wide, and
`checkBulkInventory` — the sole oversell guard in `create-checkout.ts` — can
approve a sale against a 15-minute-old count.

**2. Blob writes are fire-and-forget and get dropped.** Netlify freezes a
function once its response is sent, so an un-awaited write is abandoned. The
repo already knows this — `create-checkout.ts:263-265` carries a comment
explaining exactly why `storePendingOrder` must be awaited — but the cache layer
does the opposite. That means the durable, fleet-visible tier is the one that
most often fails to be written, which compounds defect 1.

## Current state

`src/lib/cache/blobCache.ts:188-196` — delete clears only the local tier:

```ts
  async delete(key: string): Promise<void> {
    const cacheKey = this.getCacheKey(key);
    this.fallbackCache.delete(cacheKey);
    const store = this.getStore();
    if (!store) return;

    try {
      await store.delete(cacheKey);
```

`src/lib/cache/blobCache.ts:102-113` — memory tier short-circuits the blob read:

```ts
  async get(key: string): Promise<T | undefined> {
    const cacheKey = this.getCacheKey(key);

    // Check in-memory fallback first — fastest path, consistent with getOrCompute
    const fallbackEntry = this.fallbackCache.get(cacheKey);
    if (fallbackEntry) {
      const now = Date.now();
      if (now - fallbackEntry.timestamp <= fallbackEntry.ttl) {
        return fallbackEntry.value;
      }
      this.fallbackCache.delete(cacheKey);
    }
```

`src/pages/api/webhooks/square.ts:128-131`:

```ts
          await Promise.allSettled(
            variationIds.map((id) => inventoryCache.delete(id))
          );
```

`src/lib/square/inventoryCore.ts:136-144` — abandoned writes:

```ts
    const cacheWrites: Promise<void>[] = [];
    for (const r of chunkResults) {
      for (const [id, qty] of Object.entries(r.counts)) {
        counts[id] = qty;
        cacheWrites.push(inventoryCache.set(id, qty)); // cache freshly fetched values
      }
      for (const id of r.failed) failed.add(id);
    }
    void Promise.all(cacheWrites);
```

`src/lib/cache/blobCache.ts:322-336` — same pattern in `getOrCompute`:

```ts
      this.fallbackCache.set(cacheKey, entry);

      // Try to store in blob cache (don't wait for it)
      if (store) {
        store
          .set(cacheKey, JSON.stringify(entry), {
```

`src/lib/cache/blobCache.ts:360` — the TTL that governs the exposure window:

```ts
export const inventoryCache = new BlobCache<number>('inventory', 900); // 15 min
```

### The design tension you must respect

The in-memory tier exists for speed and is correct for most caches — `imageCache`
(1 h, image URLs are stable), `navigationCache`, `wordpressCache`. **Do not
delete the tier.** Inventory is the outlier: it is the one value where staleness
costs money, and it is the one the webhook tries to invalidate.

## Commands you will need

| Purpose   | Command                                       | Expected             |
|-----------|-----------------------------------------------|----------------------|
| Typecheck | `pnpm check`                                  | exit 0               |
| Tests     | `pnpm test:run -- blobCache inventory`        | all pass             |
| Full      | `pnpm test:run`                               | exit 0               |
| Coverage  | `pnpm test:coverage`                          | exit 0, no regression|
| Lint      | `pnpm lint`                                   | exit 0               |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/lib/cache/blobCache.ts`
- `src/lib/square/inventoryCore.ts`
- `src/lib/cache/__tests__/blobCache.test.ts`

**Out of scope** (do NOT touch):
- Removing the `fallbackCache` tier. It is correct for the other seven caches.
- `src/pages/api/webhooks/square.ts` — its `delete()` call becomes effective once
  `delete()` is fixed. Do not change the webhook.
- `src/pages/api/create-checkout.ts` — plan 152 changes it.
- The TTL values for caches other than `inventoryCache`.
- Cross-instance stampede protection. That is plan 176's cluster; this plan makes
  writes land and deletes propagate, which is a prerequisite, not the same thing.

## Git workflow

- Branch: `advisor/166-make-cache-writes-durable-and-invalidation-fleet-visible`
- Conventional commits, e.g. `fix: await blob cache writes and give inventory a short memory TTL`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Confirm the Netlify freeze behavior before relying on it

The repo asserts (in `create-checkout.ts:263-265`) that un-awaited writes are
abandoned after the response is sent. Confirm it rather than assuming: add a
temporary `console.info` immediately after the un-awaited `store.set(...)`
resolves in `getOrCompute`, deploy a preview, hit a cache-miss route once, and
check the function logs.

**Verify**: record whether the post-response log line appears. If writes *do*
complete, Step 3 is lower-value — say so in the status row, but still make them
awaited for determinism. Remove the temporary logging before committing.

### Step 2: Give `inventoryCache` a short in-memory TTL

Add an optional per-cache "memory TTL" to `BlobCache`, defaulting to the existing
blob TTL so every other cache is unchanged. Set `inventoryCache`'s memory TTL to
something small (**start at 10 s** — long enough to dedupe within one render,
short enough that a blob-level delete is observed fleet-wide almost immediately).

`get()` and `getOrCompute()` must treat the memory entry as expired past the
memory TTL and fall through to the blob.

This is deliberately *not* "bypass memory for inventory" — a single page render
reads many variation IDs, and a 10 s window keeps that cheap while closing the
15-minute exposure to ~10 s.

**Verify**: `pnpm check` → exit 0.

### Step 3: Await the blob writes

- `inventoryCore.ts:144`: `void Promise.all(cacheWrites)` → awaited.
- `blobCache.ts:~330`: await the `store.set(...)` in `getOrCompute`, keeping the
  existing `.catch()` behavior so a write failure still returns the computed
  value rather than throwing.

Replace the "don't wait for it" comment with one explaining that Netlify freezes
the function after the response, so an un-awaited write is dropped — and cite
`create-checkout.ts`'s comment as the precedent.

**Verify**: `grep -n "void Promise.all(cacheWrites)" src/lib/square/inventoryCore.ts`
→ no match. `grep -n "don't wait for it" src/lib/cache/blobCache.ts` → no match.

### Step 4: Measure the added latency

Awaiting writes adds blob round-trips to the request path. Measure a cold
category page render before and after.

**Verify**: record both numbers in the status row. If the regression exceeds
~150 ms, report before proceeding — the tradeoff is the operator's.

### Step 5: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm test:coverage
```
→ all exit 0.

## Test plan

Extend `src/lib/cache/__tests__/blobCache.test.ts` (read it first — it already
mocks `getStore`; note its mock shape must track any signature change):

- a cache with a short memory TTL returns the **blob** value after the memory TTL
  elapses, even when a memory entry exists (use `vi.useFakeTimers()`)
- caches without a memory TTL behave exactly as before (regression proof for the
  other seven caches)
- `getOrCompute` awaits its blob write — assert the mock `set` resolved before
  the function returns
- a failing blob write still returns the computed value and does not throw
- `delete()` removes both tiers

Add an `inventoryCore` test asserting the fetch path awaits its writes.

`pnpm test:coverage` → exit 0. `inventory.ts` has a per-file threshold; confirm
it still passes.

## Done criteria

- [ ] Step 1's freeze-behavior finding recorded in `plans/README.md`
- [ ] `grep -n "void Promise.all(cacheWrites)" src/lib/square/inventoryCore.ts` → no match
- [ ] `inventoryCache` has a short memory TTL; the other seven caches are unchanged
- [ ] Regression test proves non-inventory caches behave as before
- [ ] Step 4's before/after latency recorded
- [ ] `src/pages/api/webhooks/square.ts` unmodified (`git status`)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` all exit 0
- [ ] `pnpm test:coverage` exits 0, no threshold regression

## STOP conditions

Stop and report if:

- **Awaiting writes regresses request latency by more than ~150 ms.** Trading
  checkout correctness for latency is the operator's call, not yours.
- The short memory TTL causes a visible increase in Blobs read volume that
  concerns you (check whether Netlify surfaces this).
- `blobCache.test.ts`'s existing mocks cannot express a two-tier TTL without
  restructuring the module. Report rather than rewriting `BlobCache`'s shape.
- You conclude the correct fix is removing the memory tier for inventory
  entirely. That may well be right, but it is a bigger latency change — report
  with the numbers.

## Maintenance notes

- **The rule**: any cache whose staleness costs money or correctness needs a
  memory TTL short enough that a blob-level delete propagates. Right now that is
  `inventoryCache` alone; a future `pricingCache` would qualify too.
- This plan does **not** solve cache stampedes (many instances recomputing at
  once when a shared entry expires). That is plan 176's cluster, and it becomes
  more visible once writes actually land.
- A reviewer should confirm the seven non-inventory caches are behaviorally
  unchanged — that regression test is the important one.
- **Deliberately deferred**: a generation/version counter read from Blobs, which
  would make invalidation instant rather than TTL-bounded. Bigger change, needs
  the stampede work alongside it.
