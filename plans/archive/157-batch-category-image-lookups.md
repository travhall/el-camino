# Plan 157: Replace the per-category serial Square round-trips in Sidebar and CategoryStrip

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update this
> plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/components/Sidebar.astro src/components/CategoryStrip.astro src/lib/cache/blobCache.ts`
> On any change, compare the excerpts below against live code first; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

Two always-rendered components resolve category images by looping over
categories and awaiting **one Square API call per category, sequentially**, with
no cache at the call site.

- `Sidebar` renders on the home page (via `ArticleGrid`), so the home page's
  TTFB includes one serial Square round-trip per top-level category.
- `CategoryStrip` renders on `/the-shop` and loops over the **flattened**
  hierarchy — every top-level category *plus* every subcategory.

At a typical 100–250 ms per Square call, this is roughly 1–3 s added to home
page TTFB and considerably more on `/the-shop`, paid on every cache-cold render.
Square's `catalog.batchGet` accepts many IDs in one call and is already used in
this repo, so the fix is mechanical.

`CategoryStrip`'s own comment claims a cache absorbs repeats. It does not — the
loop calls `squareClient.catalog.object.get` directly. That comment is wrong and
must be corrected as part of this change.

## Current state

`src/components/Sidebar.astro:33-42`:

```astro
// Process categories to get images (for existing categories only)
for (const item of categoriesWithImages) {
  try {
    // Only try to fetch if we have a category ID
    if (item.id) {
      // Retrieve the category object with related objects
      const catResult = await squareClient.catalog.object.get({
        objectId: item.id,
        includeRelatedObjects: true,
      });
```

`src/components/CategoryStrip.astro:52-66`:

```astro
// Fetch Square CDN image URLs for every entry — top-tier and sub alike.
// Sequential loop matches Sidebar.astro; the cache absorbs repeat calls
// if Sidebar has already resolved the same IDs in this request.
const categoryImageUrls: Record<string, string> = {};

for (const cat of flatCategories) {
  if (!cat.id) continue;
  try {
    const catResult = await squareClient.catalog.object.get({
      objectId: cat.id,
      includeRelatedObjects: true,
    });
    const imageObjects = ((catResult as any).relatedObjects ?? []).filter(
      (obj: any) => obj.type === "IMAGE",
    );
```

### The batch API, already used here

`src/pages/order-confirmation.astro:112-118` is the exemplar — match its shape:

```astro
            await squareClient.catalog.batchGet({
              objectIds: catalogIds,
              includeRelatedObjects: true,
            });

          const objectMap: Record<string, any> = {};
          batchResult.objects?.forEach((obj: any) => {
```

### The cache, already defined

`src/lib/cache/blobCache.ts:365`:

```ts
export const imageCache = new BlobCache<string>('image', 3600); // 1 hr (image URLs are stable)
```

Category images are stable, so a 1-hour TTL is appropriate. Read `BlobCache`'s
`getOrCompute` signature before using it.

## Commands you will need

| Purpose   | Command              | Expected            |
|-----------|----------------------|---------------------|
| Typecheck | `pnpm check`         | exit 0, 0 errors    |
| Tests     | `pnpm test:run`      | exit 0              |
| Coverage  | `pnpm test:coverage` | exit 0, no regression|
| Lint      | `pnpm lint`          | exit 0              |
| Build     | `pnpm build`         | exit 0              |
| Dev server| `pnpm dev`           | serves on :4321     |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/components/Sidebar.astro`
- `src/components/CategoryStrip.astro`
- a new shared helper, e.g. `src/lib/square/categoryImages.ts` (create)
- its test file under `src/lib/square/__tests__/`

**Out of scope** (do NOT touch):
- `src/lib/cache/blobCache.ts` — use `imageCache` as it exists. Its
  cross-instance invalidation weakness is plan 166's territory; do not try to
  fix it here.
- The rendered markup or the fallback path
  (`Sidebar.astro`'s `/images/category-${category.slug}.png`). Behavior must be
  byte-identical; this is a data-fetching change only.
- `src/lib/square/imageUtils.ts`'s per-ID `getImageUrl` fan-out. That is the
  same class of problem on a different path (plan 176's cluster), but it is a
  separate call site with a separate cache. Do not widen scope into it.

## Git workflow

- Branch: `advisor/157-batch-category-image-lookups`
- Conventional commits, e.g.
  `perf: batch and cache category image lookups instead of one Square call each`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Extract a shared, cached, batched resolver

Create `src/lib/square/categoryImages.ts` exporting one function that takes an
array of category IDs and returns `Record<string, string>` (id → image URL):

- Check `imageCache` for each ID first; collect the misses.
- If there are misses, resolve them in **one** `catalog.batchGet` call (chunk at
  ~200 IDs if the list can exceed that).
- Extract `IMAGE` objects from `relatedObjects`, matching the existing
  extraction logic in both components exactly.
- Write each resolved URL back to `imageCache`.
- On any Square error, return whatever was resolved and let callers fall back —
  match the current `try/catch`-per-category tolerance, which never fails the
  page.

**Verify**: `pnpm check` → exit 0.

### Step 2: Switch both components to the resolver

Replace both loops with a single call. Keep every downstream behavior identical,
including the per-category fallback image.

**Verify**:
```bash
grep -n "catalog.object.get" src/components/Sidebar.astro src/components/CategoryStrip.astro
```
→ no matches.

### Step 3: Correct the misleading comment

`CategoryStrip.astro:53-55` claims a cache absorbs repeat calls. With Step 1 that
becomes true — rewrite it to say what actually happens (a shared `imageCache`
lookup plus one batched fetch for misses) rather than leaving a claim that was
false when written.

**Verify**: `grep -n "the cache absorbs repeat calls" src/components/CategoryStrip.astro`
→ no match.

### Step 4: Measure the improvement

Start `pnpm dev`. With the blob cache cold (restart the dev server), load `/` and
`/the-shop` and record server render time from the terminal output or a
`performance.now()` bracket you add temporarily and remove before committing.

**Verify**: record before/after numbers and the Square call count for each page
in the `plans/README.md` status row. The call count for category images should
drop to **1 batch call** (or 0 on a warm cache) per page.

### Step 5: Confirm the pages render identically

Compare the rendered category strip and sidebar against `master`:

```bash
curl -s http://localhost:4321/          > /tmp/home-after.html
curl -s http://localhost:4321/the-shop  > /tmp/shop-after.html
```

**Verify**: every category shows the same image as before, and categories
without a Square image still show the `/images/category-<slug>.png` fallback.

### Step 6: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```
→ all exit 0.

## Test plan

Add `src/lib/square/__tests__/categoryImages.test.ts`, mocking the Square client
the way `src/lib/square/__tests__/categoryNav.test.ts` does (read it first — note
the mock-path pitfall documented in plan 140's status row: mock `'../categories'`,
not `'./categories'`, from inside `__tests__/`).

Cases:
- all IDs cached → zero Square calls, correct map returned
- all IDs uncached → exactly one `batchGet` call, results written to cache
- mixed hit/miss → one `batchGet` containing only the missing IDs
- a category with no `IMAGE` in `relatedObjects` → omitted from the map (caller falls back)
- Square throws → returns the cached subset, does not throw
- more than the chunk size of IDs → chunked into the expected number of calls

`pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

- [ ] `grep -n "catalog.object.get" src/components/Sidebar.astro src/components/CategoryStrip.astro` → no matches
- [ ] `src/lib/square/categoryImages.ts` exists with the tests above passing
- [ ] Step 4's before/after render times and Square call counts recorded in `plans/README.md`
- [ ] Category images and fallbacks render identically to `master` on `/` and `/the-shop`
- [ ] The false cache comment in `CategoryStrip.astro` is corrected
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0
- [ ] `pnpm test:coverage` exits 0, no threshold regression
- [ ] Only in-scope files modified (`git status`)

## STOP conditions

Stop and report if:

- **`catalog.batchGet` does not return `relatedObjects`** the same way
  `catalog.object.get` does. The image URL is extracted from `relatedObjects`, so
  a shape difference changes the extraction — report rather than guessing at a
  mapping.
- The batch response omits objects the per-ID calls returned (Square sometimes
  treats missing IDs differently in batch). Category images silently disappearing
  is worse than the current latency.
- Category IDs turn out not to be catalog object IDs valid for `batchGet`.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The pattern to apply elsewhere**: this repo has several `ids.map(id => oneApiCall(id))`
  fan-outs (`src/lib/square/imageUtils.ts:69`, `src/lib/square/productUtils.ts:22`,
  `src/lib/square/inventoryCore.ts:121`). This plan fixes the two on the
  always-rendered path; the rest are plan 176's cluster and should reuse whatever
  chunking helper you write here.
- A reviewer should confirm the fallback path is untouched — a category losing
  its image should still render, not break the strip.
- `imageCache`'s 1-hour TTL means a changed category image takes up to an hour to
  appear. That matches the existing `imageCache` contract; if it is a problem,
  it is a webhook-invalidation question (plan 166), not this plan's.
