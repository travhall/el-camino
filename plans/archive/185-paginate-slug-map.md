# Plan 185: Paginate the slug map so PDPs past the first catalog page stop falling back to a full catalog fetch

> **Executor instructions**: Follow step by step. Run every verification command.
> If anything in "STOP conditions" occurs, stop and report. When done, update
> this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/lib/square/slugResolver.ts src/lib/square/catalogFetch.ts src/pages/product/[id].astro`
> On any change, compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

`SlugResolver` builds its slug→ID map from a **single** Square catalog page — no
cursor loop. Square returns ~100 items per page.

So every product beyond the first page resolves to `null`, and the PDP falls back
to `await fetchProducts()` plus `createSlugMapping()` — a full cold-path catalog
fetch — **on every request**, not just on a cache miss. The map never learns
those products exist, so the fallback is permanent for them.

The repo already has correct pagination a file away: `fetchAllCatalogItems`
cursors through up to `MAX_CATALOG_PAGES = 20`. The existence of that constant is
itself evidence the catalog is expected to exceed one page.

## Current state

`src/lib/square/slugResolver.ts:50-62` — no cursor:

```ts
  private async buildSlugMap(): Promise<Record<string, string>> {
    logger.debug('[SlugResolver] Building slug map from Square API...');
    const startTime = Date.now();

    try {
      // Fetch only ITEM objects with minimal data
      const response = await squareClient.catalog.list({ types: 'ITEM' });

      const map: Record<string, string> = {};

      for (const item of response.data ?? []) {
        if (item.type === 'ITEM' && item.itemData?.name) {
```

`src/lib/square/catalogFetch.ts:10-24` — the correct pattern, in the same package:

```ts
  let requestCount = 0;

  do {
    requestCount++;
    if (requestCount > MAX_CATALOG_PAGES) {
      logger.warn(`[fetchProducts] Hit max requests limit (${MAX_CATALOG_PAGES})`);
      break;
    }
    const page = await squareClient.catalog.list({ types: "ITEM", cursor });
    if (page.data?.length) {
      allObjects.push(...page.data);
    }
    cursor = page.response.cursor;
  } while (cursor);

  return allObjects;
```

`src/pages/product/[id].astro:64-71` — the expensive fallback this triggers.

## Commands you will need

| Purpose   | Command                          | Expected             |
|-----------|----------------------------------|----------------------|
| Typecheck | `pnpm check`                     | exit 0               |
| Tests     | `pnpm test:run -- slug`          | all pass             |
| Full      | `pnpm test:run`                  | exit 0               |
| Coverage  | `pnpm test:coverage`             | exit 0, no regression|
| Lint      | `pnpm lint`                      | exit 0               |
| Dev server| `pnpm dev`                       | serves on :4321      |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/lib/square/slugResolver.ts` (`buildSlugMap` only)
- its test file under `src/lib/square/__tests__/`

**Out of scope** (do NOT touch):
- `src/lib/square/catalogFetch.ts` — it is the reference.
- `src/pages/product/[id].astro`'s fallback. Keep it as a safety net; this plan
  makes it rare, not unnecessary.
- `slugCache`'s TTL.
- The broader cold-path fan-out — **plan 176**.

## Git workflow

- Branch: `advisor/185-paginate-slug-map`
- Conventional commits, e.g. `fix(perf): paginate the slug map build`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Confirm the catalog exceeds one page

The entire impact depends on this.

```bash
grep -n "MAX_CATALOG_PAGES" src/lib/square/catalogFetch.ts
```

Then determine the real item count — from the Square dashboard, or by
instrumenting `fetchAllCatalogItems` temporarily to log its page count.

**Verify**: record the item count and page count in `plans/README.md`. If the
catalog fits in one page today, this is a latent bug — still worth fixing (it
breaks silently as the shop grows), but say so rather than overstating it.

### Step 2: Reuse the existing pagination

Prefer calling `fetchAllCatalogItems()` over hand-rolling a second cursor loop —
one pagination implementation is better than two, and it inherits the
`MAX_CATALOG_PAGES` guard and its warning.

If `fetchAllCatalogItems` returns more data than the slug map needs and that is a
memory concern, hand-roll the loop but **copy the guard and the warning**.
Whichever you choose, say why in the status row.

**Verify**:
```bash
grep -n "cursor\|fetchAllCatalogItems" src/lib/square/slugResolver.ts
```
→ pagination is present.

```bash
pnpm check
```
→ exit 0.

### Step 3: Verify a late-catalog product resolves

Pick a product you expect to be beyond the first page (from Step 1's ordering).
With `pnpm dev`, load its PDP and instrument temporarily to confirm the resolver
returns a hit rather than falling through to `fetchProducts()`.

**Verify**: the resolver resolves it; the fallback does **not** run. Record the
product slug used, and the render time before and after. Remove the
instrumentation before committing.

### Step 4: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm test:coverage
```
→ all exit 0.

## Test plan

Add to the slug resolver's test file (model on
`src/lib/square/__tests__/categoryNav.test.ts`; remember the `'../module'` mock
path rule from inside `__tests__/`):

- a mocked two-page response → the map contains items from **both** pages
  (the regression proof)
- a single-page response → unchanged behavior
- the `MAX_CATALOG_PAGES` guard stops the loop and warns
- an item without `itemData.name` is skipped as before
- a Square error mid-pagination → existing error behavior preserved

`pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

- [ ] Step 1's catalog item and page counts recorded in `plans/README.md`
- [ ] `buildSlugMap` paginates (or delegates to `fetchAllCatalogItems`)
- [ ] A test proves a two-page catalog yields a complete map
- [ ] The page-count guard is present and warns
- [ ] Step 3: a late-catalog PDP resolves without the `fetchProducts()` fallback;
      slug and before/after render times recorded
- [ ] `src/pages/product/[id].astro` unmodified (`git status`)
- [ ] All temporary instrumentation removed (`git status`)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` all exit 0

## STOP conditions

Stop and report if:

- **Building the full map becomes slow enough to hurt the first PDP request**
  after a cold cache. The map is built once and cached, but with a very large
  catalog that first build could be expensive — report the timing; the answer may
  be a background warm rather than a synchronous build.
- The catalog exceeds `MAX_CATALOG_PAGES` (20 pages ≈ 2,000 items). Then the map
  is incomplete regardless and the guard needs a deliberate decision.
- `page.response.cursor` is not the correct cursor accessor for `catalog.list` in
  this SDK version. Match `catalogFetch.ts` exactly.

## Maintenance notes

- **The rule**: any Square list call needs a cursor loop. There are now two such
  sites; a third should reuse `fetchAllCatalogItems` rather than adding a third
  implementation.
- The PDP fallback stays as a safety net. Keep it — this plan makes it rare, and
  it is what prevents a resolver gap from becoming a 404.
- This is deliberately **outside** plan 176's cold-path cluster: it is a missing
  cursor loop with an obvious fix, not something that needed measurement first.
- A reviewer should confirm the `MAX_CATALOG_PAGES` guard survived, and that
  behavior for a single-page catalog is unchanged.
