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


---

## Findings (executed 2026-11-16 at `051257c`, against the Square Sandbox account)

Method for every number: production bundle built with `PREVIEW=true astro build`
(Node adapter), started fresh per route with a temporary preload that wraps
`globalThis.fetch` and logs each outbound call (kept in the scratchpad, never in
the repo), `.env` Sandbox token, one cold hit then one warm hit by `curl`.
Local machine to Square Sandbox, so latencies are Sandbox-from-a-laptop, not
Netlify-region-to-live-Square. **Netlify Blobs is disabled in local dev
(`blobCache.ts:66-70`), so Blobs round trips were counted from code, not
timed.**

**Step 1, catalog size** (read-only `catalog/list`): 1 page, **95 items, 140
variations, 120 distinct image ids, 3 measurement units, 12 categories**
(max 14 variations on one item, mean 1.5). Under the plan's 100-item threshold,
so finding 2 (serial pagination) costs one request today. Production is
planned to be modelled on this account; re-check the live count at launch
(plan 210).

**Step 2, cold render per route** (5 cold runs; `/` three times):

| Route | Cold first byte | Cold total | Warm total | Outbound calls | Of which `catalog/object/{id}` |
|---|---|---|---|---|---|
| `/` | 0.68-0.73 s | 1.85-1.89 s | 0.009 s | 120 | 114 |
| `/the-shop` | 0.64 s | 1.87 s | 0.17 s | 120 | 114 |
| `/category/apparel` | 1.48 s | 1.66 s | 0.011 s | 119 | 114 |
| `/shop/all` | 1.39 s | 1.68 s | 0.016 s | 119 | 114 |
| `/product/baker-825-rowan-kill-deck` | 1.99 s | 2.16 s | 0.008 s | 121 | 115 |

Every route pays the same ~114 per-id catalog GETs, because Nav reaches
`fetchProducts()` on a cold cache (finding 1 confirmed). On the cold `/` run the
timeline was: WordPress x2 serial 0-480 ms; three `catalog/list` calls 338-820
ms (the third waits for the first two); **all 114 object GETs fired at once**
(max concurrency 114, average call 378 ms, window 863-1377 ms, sum of call time
about 43 s); one `batch-retrieve` 1388-1547 ms. Critical path about 1.55 s. No
retries or timeouts occurred in any run.

**Step 3, does Nav's 5 s budget trip?** Not at this size. Cold totals were at
most 2.2 s, and all 6 nav items were present in every cold response. The 3.5 s
(staging) and 7.4 s (production) cold first bytes seen by plan 214 are **not
reproduced here**, so they come from something this setup cannot see: function
cold start, region latency to Square, or Blobs. Unresolved; the next step is
function-side timing logs on a deployed site, not more local measurement.

**Step 4, sizing the fixes**
- Findings 3 and 4 (per-id GETs, 114 per cold render): because they run fully
  in parallel, the wall cost is the 514 ms window, not the 43 s sum. One
  `batch-retrieve` took 159-164 ms in these runs, so replacing 114 GETs with
  one or two batch calls saves about **350 ms of a ~1.9 s cold render (~19%)**.
  The larger win is not latency: it is going from 114 simultaneous requests per
  cold instance to 1-2. Concurrency scales with catalog size and instance count;
  at several hundred items and several cold instances this is where Square rate
  limiting would appear. Not measured.
- Finding 5 (per-entity Blobs reads): by code about 140 inventory + 120 image
  keys per cold listing, each a separate Blobs GET, all `Promise.all`. Cannot be
  sized without a deployed measurement; if each is a few tens of ms in parallel
  it is noise at this size. Held.
- Finding 2 (serial pagination): zero cost at 95 items (1 page). Each extra
  page is about 300 ms serial (the observed `catalog/list` call time), so 500
  items would add about 1.2 s. Matters only if the live catalog passes 100
  items.
- Finding 6 (retry wraps the composite): no retry fired in any run; irrelevant
  until a timeout actually occurs.

**Step 5, stampede and `stale-while-revalidate=0`.** No traffic data is
available, so the stampede cost is unestimated. On `swr=0`: only
`category/[...slug].astro:58-62` uses it, on the stated ground that stale HTML
would show out-of-date stock. `shop/all`, `/shop/sale` and `/` already serve
stale for 900-1800 s and also show stock, so the category page is the
inconsistent one. At TTL expiry a visitor waits a full cold render (about
1.7 s here; unknown on a cold function). Recommendation: give category pages a
short window (60 s) rather than 0, which keeps the staleness bound tighter than
the other listings and removes the user-facing wait. Plan 221.

**Step 6, sequence and why in this order**
1. **Plan 221 (swr on category pages).** One header value, no data-path change,
   removes the visible wait at expiry. First because it does not move any
   measurement the later plans depend on.
2. **Plan 222 (batch the per-id image and unit lookups).** About -350 ms cold
   and 114 concurrent calls become 1-2. Before any retry work: it shrinks
   what a retry would re-run (finding 6), and it reduces what a stampede costs
   (finding 7).
3. **Deferred, with triggers:** retry scope (6) until a timeout is observed;
   per-entity Blobs reads (5) after plan 166 settles Blobs write volume and a
   deployed measurement exists; serial pagination (2) if the live catalog
   exceeds 100 items. Nav blocking (1) stays as is while cold renders are under
   the 5 s budget; revisit if function-side timing shows the 3.5-7.4 s cold
   first bytes include a Nav timeout.
4. **Open question, not a plan:** what the 3.5-7.4 s cold first bytes consist
   of. Needs timing logs from the deployed function; see Step 3.

No production file was modified. Instrumentation lived only in the scratchpad.
