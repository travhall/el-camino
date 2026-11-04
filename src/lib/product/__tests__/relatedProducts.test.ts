/**
 * Unit tests for relatedProducts.ts's scoring/filtering algorithm.
 *
 * Plan 141 landed with a reduced scope after discovering that the 3
 * category-dependent scoring tiers (brand-category, complementary,
 * category-only) were unreachable in production: `scoreProduct` used to
 * extract a category slug via `product.url.match(/\/category\/([^\/]+)/)`,
 * but every real `Product.url` is `/product/<slug>` (see `createProductUrl`
 * in `@/lib/square/slugUtils.ts`), never `/category/...`. Plan 145 fixed
 * the source (resolving category slugs from `Product.categories`/
 * `reportingCategoryId` via the real category hierarchy instead of
 * `.url`) — the tests below mock `fetchCategoryHierarchy` to exercise the
 * now-reachable tiers.
 */
import { describe, it, expect, vi } from 'vitest';
import type { CategoryHierarchy, Product } from '@/lib/square/types';

const { CATEGORY_HIERARCHY } = vi.hoisted(() => ({
  CATEGORY_HIERARCHY: [
    {
      category: {
        id: 'cat-decks',
        name: 'Decks',
        slug: 'decks',
        isTopLevel: true,
      },
      subcategories: [],
    },
    {
      category: {
        id: 'cat-trucks',
        name: 'Trucks',
        slug: 'trucks',
        isTopLevel: true,
      },
      subcategories: [],
    },
    {
      category: {
        id: 'cat-apparel',
        name: 'Apparel',
        slug: 'apparel',
        isTopLevel: true,
      },
      subcategories: [
        {
          id: 'cat-bottoms',
          name: 'Bottoms',
          slug: 'bottoms',
          isTopLevel: false,
        },
      ],
    },
  ] satisfies CategoryHierarchy[],
}));

vi.mock('@/lib/square/categories', () => ({
  fetchCategoryHierarchy: vi.fn(() => Promise.resolve(CATEGORY_HIERARCHY)),
}));

import {
  getRelatedProducts,
  getComplementaryCategories,
  describeRelatedSection,
  isProductSoldOut,
  variationIdsOf,
  RELATION_SCORE,
} from '@/lib/product/relatedProducts';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    catalogObjectId: 'catalog-1',
    variationId: 'variation-1',
    title: 'Test Product',
    image: '/images/test.jpg',
    price: 1000,
    url: '/product/test-product',
    brand: 'brand-a',
    variations: [
      {
        id: 'v1',
        variationId: 'variation-1',
        name: 'Default',
        price: 1000,
        inStock: true,
      },
    ],
    ...overrides,
  };
}

describe('getRelatedProducts', () => {
  it('scores same-brand-only products (no category match) and reports brand-only/low', async () => {
    const source = makeProduct({ id: 'source', brand: 'brand-a' });
    const sameBrand = makeProduct({ id: 'same-brand', brand: 'brand-a' });

    const result = await getRelatedProducts(source, [source, sameBrand]);

    expect(result.products.map((p) => p.id)).toEqual(['same-brand']);
    expect(result.matchType).toBe('brand-only');
    expect(result.confidence).toBe('low');
  });

  it('excludes products with no relationship at all (score 0)', async () => {
    const source = makeProduct({ id: 'source', brand: 'brand-a' });
    const unrelated = makeProduct({ id: 'unrelated', brand: 'brand-b' });

    const result = await getRelatedProducts(source, [source, unrelated]);

    expect(result.products).toEqual([]);
  });

  it('never includes the source product itself, even though it would otherwise score', async () => {
    const source = makeProduct({ id: 'source', brand: 'brand-a' });

    const result = await getRelatedProducts(source, [source]);

    expect(result.products).toEqual([]);
  });

  it('filters out a candidate whose every variation is out of stock when excludeOutOfStock is true', async () => {
    const source = makeProduct({ id: 'source', brand: 'brand-a' });
    const outOfStock = makeProduct({
      id: 'out-of-stock',
      brand: 'brand-a',
      variations: [
        {
          id: 'v1',
          variationId: 'variation-1',
          name: 'Default',
          price: 1000,
          inStock: false,
        },
      ],
    });
    const inStock = makeProduct({
      id: 'in-stock',
      brand: 'brand-a',
      variations: [
        {
          id: 'v1',
          variationId: 'variation-1',
          name: 'Default',
          price: 1000,
          inStock: false,
        },
        {
          id: 'v2',
          variationId: 'variation-2',
          name: 'Alt',
          price: 1200,
          inStock: true,
        },
      ],
    });

    const result = await getRelatedProducts(
      source,
      [source, outOfStock, inStock],
      { maxResults: 6, excludeOutOfStock: true }
    );

    expect(result.products.map((p) => p.id)).toEqual(['in-stock']);
  });

  it('keeps out-of-stock candidates when excludeOutOfStock is not set', async () => {
    const source = makeProduct({ id: 'source', brand: 'brand-a' });
    const outOfStock = makeProduct({
      id: 'out-of-stock',
      brand: 'brand-a',
      variations: [
        {
          id: 'v1',
          variationId: 'variation-1',
          name: 'Default',
          price: 1000,
          inStock: false,
        },
      ],
    });

    const result = await getRelatedProducts(source, [source, outOfStock]);

    expect(result.products.map((p) => p.id)).toEqual(['out-of-stock']);
  });

  it('caps returned products at config.maxResults even when more candidates score above 0', async () => {
    const source = makeProduct({ id: 'source', brand: 'brand-a' });
    const candidates = [1, 2, 3, 4].map((n) =>
      makeProduct({ id: `same-brand-${n}`, brand: 'brand-a' })
    );

    const result = await getRelatedProducts(source, [source, ...candidates], {
      maxResults: 2,
    });

    expect(result.products).toHaveLength(2);
  });

  it('sorts results by score descending', async () => {
    const source = makeProduct({ id: 'source', brand: 'brand-a' });
    // Same brand only (score 20) vs. no relationship (score 0, filtered) —
    // add a second same-brand candidate to assert stable non-decreasing order.
    const brandMatchOne = makeProduct({
      id: 'brand-match-1',
      brand: 'brand-a',
    });
    const brandMatchTwo = makeProduct({
      id: 'brand-match-2',
      brand: 'brand-a',
    });
    const noMatch = makeProduct({ id: 'no-match', brand: 'brand-z' });

    const result = await getRelatedProducts(source, [
      source,
      noMatch,
      brandMatchOne,
      brandMatchTwo,
    ]);

    expect(result.products.map((p) => p.id)).toEqual([
      'brand-match-1',
      'brand-match-2',
    ]);
  });

  it('returns an empty result with the documented complementary/low default for empty input', async () => {
    const source = makeProduct({ id: 'source', brand: 'brand-a' });

    const result = await getRelatedProducts(source, []);

    expect(result).toEqual({
      products: [],
      scores: [],
      matchType: 'complementary',
      confidence: 'low',
    });
  });

  // Plan 145 regression coverage: category slugs are now resolved from real
  // `reportingCategoryId`/`categories` fields (via the mocked category
  // hierarchy above), not parsed from `.url`. Before the fix, none of these
  // 4 cases could ever score above 20 (same-brand-only) in production.
  it('scores same-brand + complementary-category as the top tier (100, brand-category/high)', async () => {
    const source = makeProduct({
      id: 'source',
      brand: 'brand-a',
      reportingCategoryId: 'cat-decks',
    });
    const complementarySameBrand = makeProduct({
      id: 'complementary-same-brand',
      brand: 'brand-a',
      reportingCategoryId: 'cat-trucks',
    });

    const result = await getRelatedProducts(source, [
      source,
      complementarySameBrand,
    ]);

    expect(result.products.map((p) => p.id)).toEqual([
      'complementary-same-brand',
    ]);
    expect(result.matchType).toBe('brand-category');
    expect(result.confidence).toBe('high');
  });

  it('scores same-brand + same-category (80) above same-brand-only (20)', async () => {
    const source = makeProduct({
      id: 'source',
      brand: 'brand-a',
      reportingCategoryId: 'cat-decks',
    });
    const sameCategorySameBrand = makeProduct({
      id: 'same-category-same-brand',
      brand: 'brand-a',
      reportingCategoryId: 'cat-decks',
    });
    const brandOnly = makeProduct({
      id: 'brand-only',
      brand: 'brand-a',
      reportingCategoryId: 'cat-apparel', // not complementary to decks
    });

    const result = await getRelatedProducts(source, [
      source,
      brandOnly,
      sameCategorySameBrand,
    ]);

    expect(result.products.map((p) => p.id)).toEqual([
      'same-category-same-brand',
      'brand-only',
    ]);
    expect(result.matchType).toBe('brand-category');
    expect(result.confidence).toBe('high');
  });

  it('scores complementary-category-only (different brand) as complementary/medium', async () => {
    const source = makeProduct({
      id: 'source',
      brand: 'brand-a',
      reportingCategoryId: 'cat-decks',
    });
    const complementaryDifferentBrand = makeProduct({
      id: 'complementary-different-brand',
      brand: 'brand-b',
      reportingCategoryId: 'cat-trucks',
    });

    const result = await getRelatedProducts(source, [
      source,
      complementaryDifferentBrand,
    ]);

    expect(result.products.map((p) => p.id)).toEqual([
      'complementary-different-brand',
    ]);
    expect(result.matchType).toBe('complementary');
    expect(result.confidence).toBe('medium');
  });

  it('scores same-category-only (different brand, non-complementary) as category-only/medium', async () => {
    const source = makeProduct({
      id: 'source',
      brand: 'brand-a',
      reportingCategoryId: 'cat-decks',
    });
    const sameCategoryDifferentBrand = makeProduct({
      id: 'same-category-different-brand',
      brand: 'brand-b',
      reportingCategoryId: 'cat-decks',
    });

    const result = await getRelatedProducts(source, [
      source,
      sameCategoryDifferentBrand,
    ]);

    expect(result.products.map((p) => p.id)).toEqual([
      'same-category-different-brand',
    ]);
    expect(result.matchType).toBe('category-only');
    expect(result.confidence).toBe('medium');
  });

  it('resolves category from the first entry in `categories` when `reportingCategoryId` is absent', async () => {
    const source = makeProduct({
      id: 'source',
      brand: 'brand-a',
      categories: ['cat-decks'],
    });
    const complementarySameBrand = makeProduct({
      id: 'complementary-same-brand',
      brand: 'brand-a',
      categories: ['cat-trucks'],
    });

    const result = await getRelatedProducts(source, [
      source,
      complementarySameBrand,
    ]);

    expect(result.products.map((p) => p.id)).toEqual([
      'complementary-same-brand',
    ]);
    expect(result.matchType).toBe('brand-category');
  });
});

describe('getRelatedProducts categorySlug', () => {
  it("reports the category the scorer matched on, which can be broader than the source's leaf", async () => {
    // A pant is listed under Bottoms but reports to Apparel, so a hat in
    // Apparel scores as "same category" with it
    const source = makeProduct({
      id: 'source',
      brand: 'brand-a',
      categories: ['cat-bottoms'],
      reportingCategoryId: 'cat-apparel',
    });
    const hat = makeProduct({
      id: 'hat',
      brand: 'brand-b',
      categories: ['cat-apparel'],
      reportingCategoryId: 'cat-apparel',
    });

    const result = await getRelatedProducts(source, [source, hat]);

    expect(result.scores).toEqual([RELATION_SCORE.CATEGORY]);
    expect(result.categorySlug).toBe('apparel');
  });

  it('is undefined when the source has no resolvable category', async () => {
    const source = makeProduct({ id: 'source', brand: 'brand-a' });
    const sameBrand = makeProduct({ id: 'same-brand', brand: 'brand-a' });

    const result = await getRelatedProducts(source, [source, sameBrand]);

    expect(result.categorySlug).toBeUndefined();
  });
});

describe('getComplementaryCategories', () => {
  it('returns the exact mapped array for a known category slug', () => {
    expect(getComplementaryCategories('decks')).toEqual([
      'trucks',
      'wheels',
      'bearings',
      'hardware',
      'grip-tape',
      'griptape',
    ]);
  });

  it('returns an empty array for an unknown category slug', () => {
    expect(getComplementaryCategories('not-a-real-category')).toEqual([]);
  });
});

describe('getRelatedProducts scores', () => {
  it("returns each product's score, parallel to products and sorted descending", async () => {
    const source = makeProduct({
      id: 'source',
      brand: 'brand-a',
      reportingCategoryId: 'cat-decks',
    });
    const brandAndCategory = makeProduct({
      id: 'same-brand-deck',
      brand: 'brand-a',
      reportingCategoryId: 'cat-decks',
    });
    const categoryOnly = makeProduct({
      id: 'other-deck',
      brand: 'brand-b',
      reportingCategoryId: 'cat-decks',
    });
    const brandOnly = makeProduct({ id: 'same-brand-other', brand: 'brand-a' });

    const result = await getRelatedProducts(source, [
      brandOnly,
      categoryOnly,
      brandAndCategory,
    ]);

    expect(result.products.map((p) => p.id)).toEqual([
      'same-brand-deck',
      'other-deck',
      'same-brand-other',
    ]);
    expect(result.scores).toEqual([
      RELATION_SCORE.BRAND_AND_CATEGORY,
      RELATION_SCORE.CATEGORY,
      RELATION_SCORE.BRAND,
    ]);
  });

  it('ranks a different-brand product in the same category above a same-brand product in another category', async () => {
    const source = makeProduct({
      id: 'source',
      brand: 'brand-a',
      reportingCategoryId: 'cat-decks',
    });
    const sameCategory = makeProduct({
      id: 'cat',
      brand: 'brand-b',
      reportingCategoryId: 'cat-decks',
    });
    const sameBrand = makeProduct({ id: 'brand', brand: 'brand-a' });

    const result = await getRelatedProducts(source, [sameBrand, sameCategory]);

    expect(result.products.map((p) => p.id)).toEqual(['cat', 'brand']);
  });
});

describe('describeRelatedSection', () => {
  const p = (brand?: string) => makeProduct({ brand });
  const result = (brands: Array<string | undefined>, scores: number[]) => ({
    products: brands.map(p),
    scores,
  });
  const decks = { name: 'Decks', url: '/category/decks' };
  const SHOP = { href: '/shop/all', label: 'See all products' };

  it('says "More from <brand>" and links to the brand when every item is that brand', () => {
    const section = describeRelatedSection(
      { brand: 'Thrasher' },
      result(
        ['Thrasher', 'thrasher'],
        [RELATION_SCORE.BRAND, RELATION_SCORE.BRAND]
      ),
      decks
    );

    expect(section.title).toBe('More from Thrasher');
    expect(section.seeAll).toEqual({
      href: '/shop/all?brands=Thrasher',
      label: 'See all from Thrasher',
    });
  });

  it('url-encodes the brand', () => {
    const section = describeRelatedSection(
      { brand: 'Spitfire & Co' },
      result(['Spitfire & Co'], [RELATION_SCORE.BRAND])
    );
    expect(section.seeAll.href).toBe('/shop/all?brands=Spitfire%20%26%20Co');
  });

  it('says "Complete Your Setup" when every item is a complementary category, and does not link to the source category', () => {
    const section = describeRelatedSection(
      { brand: 'Real' },
      result(
        ['Independent', 'Real'],
        [RELATION_SCORE.COMPLEMENTARY, RELATION_SCORE.BRAND_AND_COMPLEMENTARY]
      ),
      decks
    );

    expect(section.title).toBe('Complete Your Setup');
    expect(section.seeAll).toEqual(SHOP);
  });

  it('says "More in <category>" and links to it when every item is in the source category', () => {
    const section = describeRelatedSection(
      { brand: 'Real' },
      result(
        ['Real', 'Girl'],
        [RELATION_SCORE.BRAND_AND_CATEGORY, RELATION_SCORE.CATEGORY]
      ),
      decks
    );

    expect(section.title).toBe('More in Decks');
    expect(section.seeAll).toEqual({
      href: '/category/decks',
      label: 'See all Decks',
    });
  });

  it('is neutral and links to the shop for a mixed result', () => {
    const section = describeRelatedSection(
      { brand: 'Real' },
      result(
        ['Real', 'Girl', 'Real'],
        [
          RELATION_SCORE.BRAND_AND_CATEGORY,
          RELATION_SCORE.COMPLEMENTARY,
          RELATION_SCORE.BRAND,
        ]
      ),
      decks
    );

    expect(section.title).toBe('You Might Also Like');
    expect(section.seeAll).toEqual(SHOP);
  });

  it('does not claim a category when the source has none', () => {
    const section = describeRelatedSection(
      { brand: 'Real' },
      result(['Girl'], [RELATION_SCORE.CATEGORY])
    );

    expect(section.title).toBe('You Might Also Like');
    expect(section.seeAll).toEqual(SHOP);
  });

  it('does not claim a brand the source does not have', () => {
    const section = describeRelatedSection(
      {},
      result([undefined], [RELATION_SCORE.CATEGORY]),
      decks
    );

    expect(section.title).toBe('More in Decks');
  });

  it('is neutral for an empty result', () => {
    const section = describeRelatedSection({ brand: 'Real' }, result([], []));
    expect(section.title).toBe('You Might Also Like');
    expect(section.seeAll).toEqual(SHOP);
  });
});

describe('isProductSoldOut', () => {
  const variation = (variationId: string) => ({
    id: variationId,
    variationId,
    name: variationId,
    price: 10,
  });
  const stock = (entries: Record<string, boolean>) =>
    new Map(
      Object.entries(entries).map(([id, out]) => [id, { isOutOfStock: out }])
    );
  const product = makeProduct({
    variationId: 'small',
    variations: [variation('small'), variation('medium'), variation('large')],
  });

  it('is sold out only when every variation is', () => {
    expect(
      isProductSoldOut(
        product,
        stock({ small: true, medium: true, large: true })
      )
    ).toBe(true);
  });

  it('is NOT sold out when the default is sold out but another size is in stock', () => {
    expect(
      isProductSoldOut(
        product,
        stock({ small: true, medium: false, large: true })
      )
    ).toBe(false);
  });

  it('is not sold out when stock could not be looked up', () => {
    expect(isProductSoldOut(product, stock({ small: true }))).toBe(false);
    expect(isProductSoldOut(product, new Map())).toBe(false);
  });

  it('falls back to the default variation for a product that lists none', () => {
    const bare = makeProduct({ variationId: 'only', variations: undefined });
    expect(isProductSoldOut(bare, stock({ only: true }))).toBe(true);
    expect(isProductSoldOut(bare, stock({ only: false }))).toBe(false);
  });
});

describe('variationIdsOf', () => {
  it('lists every variation once, falling back to the default', () => {
    const v = (variationId: string) => ({
      id: variationId,
      variationId,
      name: variationId,
      price: 1,
    });
    expect(
      variationIdsOf(
        makeProduct({ variationId: 'a', variations: [v('a'), v('b'), v('a')] })
      )
    ).toEqual(['a', 'b']);
    expect(
      variationIdsOf(makeProduct({ variationId: 'solo', variations: [] }))
    ).toEqual(['solo']);
  });
});
