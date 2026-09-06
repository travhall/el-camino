# Plan 176: Investigation — measure and sequence the cold SSR path fan-out

> **Executor instructions**: This is an **investigation plan**, not a build plan.
> Its deliverable is measurements and a recommended sequence, written into this
> file and summarized in `plans/README.md`. **Write no production code.** If
> anything in "STOP conditions" occurs, stop and report.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/lib/square/ src/lib/cache/blobCache.ts src/components/Nav.astro`
> On any change, re-verify the excerpts below before relying on them.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (no code changes)
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

Seven separate audit findings describe **one story**: on a cache-cold render the
site fans out to Square and to Netlify Blobs one entity at a time, wraps the
whole composite operation in retries, and has no protection against every
instance recomputing at once when a shared cache entry expires.

Planning those seven as seven build plans would produce changes that fight each
other — batching the Square calls changes what the retry wraps, which changes
what a stampede costs, which changes whether the per-ID blob reads matter. The
ordering and the sizing both depend on measurements nobody has taken.

This plan takes the measurements and produces the sequence. It is deliberately
cheap and produces no risk.

**Why it is not already covered by the earlier perf work**: plans 146-151 came
from client-side DevTools traces of a **CDN-cached** HTML response (TTFB 147 ms
unthrottled). None of them touch server render time. This is the other axis.

## Current state — the seven findings, each verified

**1. Nav blocks every page on the Square catalog.** `src/components/Nav.astro:29-40`:

```astro
  categoryHierarchy = await catalogRetryClient.executeWithRetry(
    () => fetchCategoryHierarchyWithProducts(),
    "navigation-fetch",
    {
      maxRetries: 2,
      baseDelay: 1000,
      maxDelay: 3000,
      timeoutMs: 5000, // Reduced to 5s - simple category fetch is fast
    },
  );
```

`Layout.astro` renders `Header` → `Nav` on every route, and on a cold
`navigationCache` this path reaches `fetchProducts()` — the entire catalog.

**2. Catalog pagination is serial.** `src/lib/square/catalogFetch.ts:10-24` loops
on a cursor up to `MAX_CATALOG_PAGES = 20`, one request at a time.

**3. One Square call per image.** `src/lib/square/imageUtils.ts:69`:

```ts
  const imagePromises = uncachedIds.map((id) => getImageUrl(id));
```

**4. One Square call per measurement unit.** `src/lib/square/productUtils.ts:22-24`,
same `.map()` shape.

**5. One Blobs round-trip per entity.** `src/lib/square/inventoryCore.ts:119-127`:

```ts
    await Promise.all(
      unique.map(async (id) => {
        const cached = await inventoryCache.get(id);
```

and `src/lib/square/imageUtils.ts:44-51`, same shape. Callers pass large lists —
category pages fetch up to 200 products.

**6. Retry wraps the whole composite operation.** `src/lib/square/client.ts:26-34`:

```ts
  return productCache.getOrCompute(cacheKey, () =>
    requestDeduplicator.dedupe(cacheKey, () =>
      catalogRetryClient.executeWithRetry(async () => {
        try {
          const allObjects = await fetchAllCatalogItems();
```

A timeout discards all in-flight work and re-runs pagination **plus** every
fan-out, up to `maxRetries` times.

**7. Deduplication is per-instance, so stampedes are unprotected.**
`src/lib/square/requestDeduplication.ts:2-3`:

```ts
class RequestDeduplicator {
  private inflight = new Map<string, Promise<unknown>>();
```

That Map lives in one Lambda instance. And `src/pages/category/[...slug].astro:66-74`
sets `stale-while-revalidate=0`, so at TTL expiry the CDN **blocks** on a fresh
origin render rather than serving stale.

## Commands you will need

| Purpose    | Command       | Expected        |
|------------|---------------|-----------------|
| Typecheck  | `pnpm check`  | exit 0          |
| Dev server | `pnpm dev`    | serves on :4321 |
| Build      | `pnpm build`  | exit 0          |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- This plan file (write findings into it)
- `plans/README.md` (summary + the recommended sequence)
- **Temporary, uncommitted** instrumentation to take measurements
- Optionally: new plan files for the sequence you recommend

**Out of scope** (do NOT do):
- **Any production code change.** Not one. If you find a one-line fix, write it
  down as a recommendation.
- Committing instrumentation. Remove it before finishing.
- Changing cache TTLs, retry config, or cache-control headers.

## Git workflow

- Branch: `advisor/176-investigate-cold-ssr-path`
- Commit only this plan file and `plans/README.md`.
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Get the real catalog size

Everything scales with this, and it is currently unknown — a prior audit noted
`dist/sitemap-0.xml` was built without Square credentials.

Count total catalog ITEMs, total variations, distinct image IDs, and distinct
measurement units, against the real Square account.

**Verify**: four numbers recorded. If the catalog is small (say <100 items, one
page), several findings shrink dramatically — **say so**, and expect the
recommended sequence to change accordingly.

### Step 2: Instrument and measure a cold render

With temporary timing instrumentation, and caches cold (restart the dev server),
record for `/`, `/the-shop`, `/category/<slug>`, and a PDP:

- total server render time
- time in `fetchProducts()` / `fetchAllCatalogItems()`
- number of Square API calls, by kind
- number of Blobs GETs and PUTs
- time in Nav's `fetchCategoryHierarchyWithProducts()`

**Verify**: a table of these per route. This is the plan's core deliverable.

### Step 3: Determine whether the 5 s Nav timeout actually trips

Finding 1 predicts Nav's 5 s budget is exceeded on a cold instance, silently
rendering an empty nav (`Nav.astro:48`'s fallback).

From Step 2's timings, work out how often the cold path exceeds 5 s. If possible,
check production logs for the retry/timeout messages `apiRetry.ts` emits.

**Verify**: state whether this trips in practice, with evidence. **If it does,
that is a user-visible bug** (missing navigation), not just a latency issue — and
it likely jumps the queue.

### Step 4: Size the individual fixes

For each of findings 3, 4, 5, estimate the saving from Step 1's counts and Step
2's per-call timings. Batching helps in proportion to entity count — with 20
products it is noise; with 500 it dominates.

**Verify**: an estimated saving per fix, with the arithmetic shown.

### Step 5: Assess the stampede risk honestly

Finding 7 depends on concurrent traffic. Estimate from real traffic data if
available; otherwise say so plainly rather than guessing.

Note the interaction: `stale-while-revalidate=0` on category pages means users
wait for a rebuild. Changing that one value may be the cheapest large win in the
whole cluster — evaluate it.

**Verify**: a recommendation on `swr=0`, with reasoning.

### Step 6: Write the sequence

Produce an ordered list of follow-up plans, each with: what it changes, expected
saving (from Steps 2–4), risk, and **why it comes at that point** — specifically
which measurements it invalidates for the plans after it.

Cover ordering interactions explicitly: batching (3, 4) changes what retry (6)
wraps; fixing retry changes what a stampede (7) costs; plan 166 (durable writes
and fleet-visible invalidation) changes Blobs volume, affecting (5).

**Verify**: the sequence is written into this file and summarized in
`plans/README.md`.

### Step 7: Remove all instrumentation

**Verify**: `git status` shows only this plan file and `plans/README.md` modified.
`pnpm check && pnpm build` → exit 0.

## Test plan

No tests — no production code changes. The deliverable is measurements. Each
number must state how it was obtained, so a later executor can reproduce it.

## Done criteria

- [ ] Step 1's four catalog-size numbers recorded
- [ ] Step 2's per-route table (render time, Square calls, Blobs ops) recorded
- [ ] Step 3 states whether Nav's 5 s timeout trips, with evidence
- [ ] Step 4 gives an estimated saving per fix, with arithmetic
- [ ] Step 5 gives a `stale-while-revalidate=0` recommendation with reasoning
- [ ] Step 6's ordered sequence written here and summarized in `plans/README.md`
- [ ] **No production file modified** (`git status`)
- [ ] `pnpm check` and `pnpm build` exit 0

## STOP conditions

Stop and report if:

- **You cannot measure against a real catalog.** Every estimate depends on Step
  1; a sequence built on a guessed catalog size is worse than no sequence.
- Step 3 shows Nav's timeout trips regularly. That is a user-visible bug — report
  immediately rather than finishing the full investigation first.
- The measurements contradict the findings — e.g. cold render is already fast and
  the fan-out is irrelevant. **That is a valid and valuable result.** Report it;
  do not manufacture work.
- You are tempted to fix something while instrumenting. Write it down instead.

## Maintenance notes

- **Why an investigation rather than seven plans**: the seven findings are
  coupled, and their individual value depends on numbers nobody had. Seven
  parallel plans would conflict in `src/lib/square/` and each would invalidate the
  others' assumptions.
- Findings deliberately pulled **out** of this cluster because they are genuinely
  independent: plan 157 (category image batching, on the always-rendered path),
  plan 185 (slug-map pagination), plan 187 (site-context duplicate blob reads).
  Those did not need measurement first.
- The output of this plan should be new numbered plans. Keep numbering monotonic
  and record them in `plans/README.md`.
- If the answer turns out to be "the catalog is small, this does not matter",
  that is worth writing down permanently so nobody re-audits it in six months.
