# Plan 141: Add unit tests for `relatedProducts.ts`'s scoring algorithm

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cdf74a3..HEAD -- src/lib/product/relatedProducts.ts`
> If the file changed since this plan was written, compare the "Current
> state" excerpt against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: test-coverage
- **Planned at**: commit `cdf74a3`, 2026-09-04

## Why this matters

`src/lib/product/relatedProducts.ts` is the "customers who bought this also
bought" logic — pure, hand-authored scoring rules with no I/O — but has
zero direct test coverage. `src/pages/api/__tests__/related-products.test.ts`
mocks `getRelatedProducts` entirely (`vi.fn()`), so the route test exercises
none of the real scoring algorithm. A typo in the `COMPLEMENTARY_CATEGORIES`
mapping (e.g. a category-slug that doesn't match the live URL scheme) or a
scoring-tier boundary error would currently ship silently — nothing verifies
"decks show trucks/wheels as complementary" actually works.

## Current state

`src/lib/product/relatedProducts.ts` (full file, 174 lines):

```ts
const COMPLEMENTARY_CATEGORIES: Record<string, string[]> = {
  decks: ['trucks', 'wheels', 'bearings', 'hardware', 'grip-tape', 'griptape'],
  trucks: ['decks', 'wheels', 'bearings', 'hardware'],
  wheels: ['trucks', 'bearings', 'bearings-spacers'],
  bearings: ['decks', 'trucks', 'wheels'],
  hardware: ['decks', 'trucks'],
  'grip-tape': ['decks'],
  griptape: ['decks'],
  apparel: ['footwear', 'accessories'],
  footwear: ['apparel', 'accessories', 'insoles'],
  accessories: ['apparel', 'footwear'],
};

function scoreProduct(sourceProduct, candidateProduct, sourceCategorySlug?): number {
  // same brand + complementary category → 100
  // same brand + same category → 80
  // complementary category only → 60
  // same category only → 40
  // same brand only → 20
  // none of the above → 0
  // category slug is extracted via candidateProduct.url.match(/\/category\/([^\/]+)/)
}

export async function getRelatedProducts(
  sourceProduct: Product,
  allProducts: Product[],
  config: RelatedProductsConfig = { maxResults: 6 }
): Promise<RelatedProductsResult> {
  // extracts sourceCategorySlug from sourceProduct.url the same way
  // filters out sourceProduct.id itself
  // optionally filters out-of-stock (config.excludeOutOfStock, checks
  //   p.variations?.some((v) => v.inStock))
  // scores + filters (score > 0) + sorts descending + slices to config.maxResults
  // derives matchType/confidence from the TOP-scoring result:
  //   100 → matchType 'brand-category', confidence 'high'
  //   >=80 → matchType 'brand-category', confidence 'high'
  //   >=60 → matchType 'complementary', confidence 'medium'
  //   >=40 → matchType 'category-only', confidence 'medium'
  //   else (i.e. score 20, brand-only) → matchType 'brand-only', confidence 'low'
  //   (no results at all → matchType defaults to 'complementary', confidence 'low')
}

export function getComplementaryCategories(categorySlug: string): string[] {
  return COMPLEMENTARY_CATEGORIES[categorySlug] || [];
}
```

`src/pages/api/__tests__/related-products.test.ts:7-8` currently mocks:
```ts
vi.mock('@/lib/product/relatedProducts', () => ({
  getRelatedProducts: vi.fn(),
}));
```
— confirms this route test provides zero coverage of the real algorithm;
this plan's new file is independent of that route test and doesn't need to
touch it.

`Product` type (from `@/lib/square/types`) — check its exact shape before
writing fixtures; at minimum this file's logic reads `.id`, `.brand`,
`.url`, and `.variations[].inStock`.

## Commands you will need

| Purpose   | Command                                          | Expected on success |
|-----------|-------------------------------------------------------|----------------------|
| Typecheck | `pnpm check`                                        | exit 0, no errors    |
| Tests     | `pnpm test:run -- relatedProducts`                 | all pass             |
| Coverage  | `pnpm test:coverage`                                 | exit 0, thresholds met |

## Scope

**In scope**:
- New file: `src/lib/product/__tests__/relatedProducts.test.ts`

**Out of scope**:
- `src/lib/product/relatedProducts.ts` itself — tests only, no source
  changes. If a test reveals what looks like a real bug (e.g. a
  `COMPLEMENTARY_CATEGORIES` entry that doesn't match how category slugs
  actually appear in `Product.url` elsewhere in the codebase), report it and
  stop rather than silently "fixing" either side.
- `src/pages/api/related-products.ts` and its existing test — untouched;
  this plan adds direct unit coverage for the algorithm, it doesn't change
  the route-level mock-based test.

## Git workflow

- Branch: `advisor/141-test-related-products-scoring`
- Single commit.
- Commit message style: lowercase, conventional-ish prefix, e.g.
  `test: add coverage for relatedProducts.ts's scoring algorithm`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Build minimal product fixtures

Define a small helper (e.g. `makeProduct(overrides): Product`) that returns
a minimally-valid `Product` with sensible defaults (`id`, `brand`, `url`
like `/category/decks/some-slug`, `variations: [{ inStock: true }]`), so
each test case only needs to override the 2-3 fields it cares about. Check
`@/lib/square/types`'s `Product` interface first to make sure every
required field is present in the fixture (avoid `as any` — use real values
or `as Product` only where a field genuinely doesn't matter for the test).

### Step 2: Test `scoreProduct`'s five scoring tiers via `getRelatedProducts`

`scoreProduct` isn't exported — test it indirectly through
`getRelatedProducts`'s `matchType`/`confidence` output and the score-implied
ordering of `products` in the result. Cases:
- Same brand + complementary category (e.g. source `decks`/`brand-a`,
  candidate `trucks`/`brand-a`) → appears first in results, overall
  `matchType: 'brand-category'`, `confidence: 'high'`.
- Same brand + same category (source `decks`/`brand-a`, candidate
  `decks`/`brand-a`) → scores below the complementary+brand match but above
  complementary-only.
- Complementary category, different brand → `matchType: 'complementary'`,
  `confidence: 'medium'` when it's the top scorer.
- Same category only, different brand, non-complementary → `matchType:
  'category-only'`, `confidence: 'medium'` when top scorer.
- Same brand only, unrelated/non-complementary category →
  `matchType: 'brand-only'`, `confidence: 'low'` when top scorer.
- No relationship at all (different brand, unrelated category) → excluded
  entirely from `products` (score 0 is filtered out).

**Verify**: `pnpm test:run -- relatedProducts` → each case passes.

### Step 3: Test `getRelatedProducts`'s filtering and limits

- The source product itself is never included in results, even if it would
  otherwise score.
- `config.excludeOutOfStock: true` filters out a candidate whose every
  variation has `inStock: false`; a candidate with at least one in-stock
  variation is kept.
- `config.maxResults` caps the returned `products` array length even when
  more candidates would score above 0.
- Results are sorted descending by score (assert ordering directly, not just
  presence).
- Calling with an empty `allProducts` array returns `products: []`,
  `matchType: 'complementary'`, `confidence: 'low'` (the documented
  no-results default).

**Verify**: `pnpm test:run -- relatedProducts` → each case passes.

### Step 4: Test `getComplementaryCategories`

- Returns the exact array for a known key (e.g. `'decks'` →
  `['trucks', 'wheels', 'bearings', 'hardware', 'grip-tape', 'griptape']`).
- Returns `[]` for an unknown category slug.

**Verify**: `pnpm test:run -- relatedProducts` → passes.

## Test plan

This entire plan *is* the test plan — see Steps 2-4 above. No mocking
needed (the module has no external dependencies); plain fixture objects and
direct assertions, following the style of
`src/lib/square/__tests__/money.test.ts` (a similarly pure, unmocked
function-in/value-out test file in this repo).

- Verification: `pnpm test:run -- relatedProducts` → all new cases pass.
- Verification: `pnpm test:coverage` → `src/lib/product/relatedProducts.ts`
  coverage rises from 0% to near-complete (it's a small, fully-exercisable
  file); no repo-wide threshold regression.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run -- relatedProducts` exits 0, covering all 5 scoring
      tiers, the zero-score exclusion, out-of-stock filtering, `maxResults`
      capping, result ordering, the empty-input default, and
      `getComplementaryCategories`
- [ ] `pnpm test:coverage` exits 0, no threshold regression;
      `relatedProducts.ts` coverage measurably above 0%
- [ ] Only `src/lib/product/__tests__/relatedProducts.test.ts` created
      (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The live `relatedProducts.ts` doesn't match "Current state" (drift).
- A test reveals `scoreProduct`'s category-slug extraction
  (`url.match(/\/category\/([^\/]+)/)`) doesn't actually match the real URL
  format products have elsewhere in this codebase (check
  `src/lib/square/productMapper.ts` or wherever `Product.url` is
  constructed, if the fixture assumption feels uncertain) — report the
  mismatch rather than adjusting the regex or building a fixture that
  papers over it.

## Maintenance notes

- If `COMPLEMENTARY_CATEGORIES` gains or changes entries in the future
  (e.g. a new product category), this test file's fixtures don't need to
  change — the tests exercise the scoring *logic*, not every category
  mapping exhaustively. Only add a new test if a new category introduces a
  genuinely new scoring interaction worth characterizing.
- `getRelatedProducts` is declared `async` but contains no `await` — this
  plan's tests should still `await` the call (or use `.resolves`) since the
  function's public signature is a `Promise`, even though nothing here
  requires fake timers or async mocking.
