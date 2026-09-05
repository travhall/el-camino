# Plan 145: Fix related-products category matching (dead scoring tiers)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cdf74a3..HEAD -- src/lib/product/relatedProducts.ts src/lib/square/productMapper.ts src/lib/square/slugUtils.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Origin**: discovered mid-execution of `plans/141-test-related-products-scoring.md`
> (a test-coverage plan) — that plan's executor correctly stopped instead of
> writing a fixture that would have papered over a real bug, and reported it
> per its own STOP conditions. This plan is the operator-approved follow-up
> fix; `plans/141-...md` proceeds separately with a reduced test scope that
> doesn't touch the dead tiers this plan fixes.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (soft: land in either order relative to 141 — see
  Dependency notes)
- **Category**: bug
- **Planned at**: commit `cdf74a3`, 2026-09-04

## Why this matters

`src/lib/product/relatedProducts.ts`'s scoring algorithm has 5 tiers, but 3
of them have never fired in production: `scoreProduct` extracts a category
slug from `candidateProduct.url`/`sourceProduct.url` via
`.match(/\/category\/([^\/]+)/)`, but every real `Product.url` is built by
`createProductUrl()` (`src/lib/square/slugUtils.ts:32-34`) as
`/product/<slug>` — the `/category/...` URL shape only exists on
category/nav-page objects, never on a `Product`. Confirmed via
`grep -rn "createProductUrl" src` (called only from `productMapper.ts:223,300`,
always producing `/product/...`) and via `grep -rn "\.url = " src/lib/square`
finding no other `Product.url` assignment site.

Consequence: `sourceCategorySlug` and `candidateCategorySlug` are always
`undefined`. `sameCategory` and `isComplementary` are always `false`. The
"customers who bought this also bought" feature — the entire point of this
module — silently degrades to just two live outcomes: same-brand-only
(score 20) or no relationship at all (score 0). The `brand-category` (100),
`complementary` (60), and `category-only` (40) tiers, and the entire
`COMPLEMENTARY_CATEGORIES` mapping (decks↔trucks↔wheels↔bearings, etc.),
have never actually influenced a single "related products" result shown to
a customer.

## Current state

`Product` (full relevant fields, `src/lib/square/types.ts:11-34`) already
carries real category membership — this plan's fix uses these instead of
parsing `.url`:
```ts
export interface Product {
  ...
  url: string; // always "/product/<slug>" — NOT usable for category info
  ...
  categories?: string[]; // Array of Square category IDs
  reportingCategoryId?: string; // Square reporting category ID
  ...
}
```
Both fields are populated in `productMapper.ts` (lines 231-232 and
307): `categories: p.categoryIds?.length > 0 ? p.categoryIds : undefined`,
`reportingCategoryId: p.reportingCategoryId || undefined` — these are Square
catalog category **IDs** (opaque strings), not the human-readable slugs
(`"decks"`, `"trucks"`, etc.) that `COMPLEMENTARY_CATEGORIES` is keyed by.

The id→slug mapping already exists elsewhere in this codebase:
`Category` (`src/lib/square/types.ts:168-176`) has both `id` and `slug`
fields, and `fetchCategoryHierarchy()` (`src/lib/square/categories.ts:84-135`,
already `categoryCache`-backed — cheap, cache-hit in the common case) returns
`CategoryHierarchy[]`, each entry a `{ category: Category, subcategories: Category[] }`
(check `categories.ts` around line 84-135 or `types.ts`'s
`CategoryHierarchy` interface for the exact shape before writing code).

`src/lib/product/relatedProducts.ts`'s current (buggy) category extraction,
both in `scoreProduct` and `getRelatedProducts`:
```ts
const candidateCategoryMatch = candidateProduct.url.match(/\/category\/([^\/]+)/);
const candidateCategorySlug = candidateCategoryMatch ? candidateCategoryMatch[1] : undefined;
```
(and the equivalent for `sourceProduct.url` in `getRelatedProducts`).

`getRelatedProducts` is declared `async` but currently has no `await` inside
it — this plan makes that a real `await` (fetching the category hierarchy).

Caller: `src/pages/api/related-products.ts` calls
`getRelatedProducts(sourceProduct, allProducts, { maxResults, excludeOutOfStock: false })`
— no signature change needed here; the hierarchy fetch happens inside
`relatedProducts.ts` itself.

## Commands you will need

| Purpose   | Command                                              | Expected on success |
|-----------|-----------------------------------------------------------|----------------------|
| Typecheck | `pnpm check`                                            | exit 0, no errors    |
| Tests     | `pnpm test:run -- relatedProducts related-products`    | all pass             |
| Coverage  | `pnpm test:coverage`                                     | exit 0, thresholds met |

## Scope

**In scope**:
- `src/lib/product/relatedProducts.ts` — replace the `.url`-based category
  extraction with a real category-ID→slug resolution.
- `src/lib/product/__tests__/relatedProducts.test.ts` — if
  `plans/141-...md` has already landed its reduced-scope version by the
  time you execute this, extend it with tests for the now-fixed
  `brand-category`/`complementary`/`category-only` tiers (using real
  `categories`/`reportingCategoryId` fixture fields instead of fake `.url`
  paths). If 141 hasn't landed yet, this plan can create the file fresh
  with the full tier coverage — either way, get the complete 5-tier
  coverage landed by the time this plan is done.

**Out of scope**:
- `src/lib/square/productMapper.ts`, `src/lib/square/slugUtils.ts` — these
  are correct as-is (the bug is entirely in how `relatedProducts.ts`
  *reads* category data, not in how it's produced/stored); do not change
  `createProductUrl` or how `categories`/`reportingCategoryId` are mapped.
- `src/pages/api/related-products.ts` — no signature or behavior change
  needed at the call site.
- `COMPLEMENTARY_CATEGORIES`'s actual content (which categories pair with
  which) — untouched; this plan fixes the mechanism that reads category
  slugs, not the business logic of which pairings make sense.

## Git workflow

- Branch: `advisor/145-fix-related-products-category-matching`
- Single commit is fine.
- Commit message style: lowercase, conventional-ish prefix, e.g.
  `fix: resolve real category slugs in relatedProducts scoring instead of parsing Product.url`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a category-ID→slug resolver

In `src/lib/product/relatedProducts.ts`, add a helper (private, not
exported) that builds a `Record<string, string>` (category ID → slug) from
`fetchCategoryHierarchy()`'s result — flatten each `CategoryHierarchy`
entry's top-level `category` plus its `subcategories` into one flat
id→slug map. Import `fetchCategoryHierarchy` from `@/lib/square/categories`.

Given `fetchCategoryHierarchy()` is already `categoryCache`-backed, calling
it once per `getRelatedProducts` invocation is cheap — do not add a second
caching layer on top of it in this file.

**Verify**: `pnpm check` → 0 errors.

### Step 2: Resolve each product's category slug from real fields, not `.url`

Add a small helper, e.g. `resolveCategorySlug(product: Product, idToSlug: Record<string, string>): string | undefined`, that:
- Takes `product.reportingCategoryId` first (Square's designated "primary"
  category for the item) if present and found in `idToSlug`.
- Falls back to `product.categories?.[0]` (the first category ID in the
  membership array) if `reportingCategoryId` is absent or unresolvable.
- Returns `undefined` if neither resolves to a known slug (matches today's
  "no category info" fallback behavior for products with no category data).

**Verify**: `pnpm check` → 0 errors.

### Step 3: Wire the resolver into `scoreProduct` and `getRelatedProducts`

- `scoreProduct`'s signature changes from taking a `sourceCategorySlug?`
  computed by the caller via URL-parsing, to receiving it as a plain
  parameter still — no change to `scoreProduct`'s own logic (the 5-tier
  scoring rules stay identical), only how the caller computes the slugs
  passed into it.
- In `getRelatedProducts`: call `fetchCategoryHierarchy()`, build the
  id→slug map (Step 1), resolve `sourceCategorySlug` via
  `resolveCategorySlug(sourceProduct, idToSlug)`, and resolve each
  candidate's category slug the same way inside the `.map()` that computes
  scores (replacing the current `.url`-based extraction there too).
- Delete the two `.match(/\/category\/([^\/]+)/)` call sites entirely.

**Verify**: `grep -n "\/category\/" src/lib/product/relatedProducts.ts` →
no matches (confirms the old URL-parsing approach is fully removed).

## Test plan

- If `plans/141-...md` already landed its reduced-scope
  `relatedProducts.test.ts` by the time you execute this: add the 5
  scoring-tier test cases its plan originally specified (same-brand +
  complementary, same-brand + same-category, complementary-only,
  category-only, same-brand-only, no-relationship), but build fixtures
  using `categories: ['cat-id-1']` / `reportingCategoryId: 'cat-id-1'`
  fields instead of fake `/category/...` URL paths, and mock
  `@/lib/square/categories`'s `fetchCategoryHierarchy` to return a small
  fixture hierarchy mapping `cat-id-1` → slug `"decks"`, `cat-id-2` → slug
  `"trucks"`, etc. (matching `COMPLEMENTARY_CATEGORIES`'s existing key
  names so the complementary-tier tests exercise real mapping entries).
- If 141 hasn't landed yet: this plan's test file should cover the full
  5-tier matrix plus the filtering/ordering cases 141's plan already
  specifies (source-exclusion, out-of-stock filter, `maxResults` cap, sort
  order, empty-input default, `getComplementaryCategories`) — at that point
  just follow `plans/141-test-related-products-scoring.md` directly, using
  this plan's fixed source and real fixtures instead of its original
  (bugged) URL-based ones.
- Either way, add at least one test proving the fix itself: a candidate
  product whose `reportingCategoryId` maps to a slug in
  `COMPLEMENTARY_CATEGORIES[sourceCategorySlug]` now scores 60+ (previously
  would have scored 0 or 20 due to the bug) — this is the regression test
  for this exact defect.

Verification: `pnpm test:run -- relatedProducts` → all pass, including the
new fixed-tier and fix-regression cases.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run -- relatedProducts related-products` exits 0
- [ ] `pnpm test:coverage` exits 0, no threshold regression
- [ ] `grep -n "\/category\/" src/lib/product/relatedProducts.ts` returns no matches
- [ ] A test exists asserting a complementary-category match now scores in
      the 60-100 range (proving the fix, not just proving old behavior
      unchanged)
- [ ] `git status` shows only `src/lib/product/relatedProducts.ts` and its
      test file modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any "Current state" excerpt doesn't match the live file (drift) —
  particularly check whether `plans/141-...md` has landed and in what form,
  since it directly determines this plan's Test plan branch.
- `CategoryHierarchy`'s actual shape (check `src/lib/square/types.ts`
  directly) doesn't match the `{ category: Category, subcategories: Category[] }`
  assumption above — adjust the flattening logic in Step 1 to the real
  shape rather than guessing.
- A product's `categories`/`reportingCategoryId` values don't actually
  correspond to any slug in the live category hierarchy in a real test
  against production-shaped data (would suggest a deeper data-consistency
  issue beyond this plan's scope) — report rather than silently falling
  back to "no category" for everything.

## Maintenance notes

- If Square category IDs are ever restructured (categories renamed,
  merged, re-parented), `COMPLEMENTARY_CATEGORIES`'s slug keys stay stable
  as long as the *slugs* don't change — this fix decouples the matching
  logic from Square's opaque IDs by resolving through slugs, same as the
  rest of this codebase already does for category pages.
- A product with no `categories`/`reportingCategoryId` at all (possible for
  some catalog items) now correctly resolves to `undefined`, same as
  today's fallback — no new edge case introduced, just a correct one for
  the common case.
