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
      subcategories: [],
    },
  ] satisfies CategoryHierarchy[],
}));

vi.mock('@/lib/square/categories', () => ({
  fetchCategoryHierarchy: vi.fn(() => Promise.resolve(CATEGORY_HIERARCHY)),
}));

import {
  getRelatedProducts,
  getComplementaryCategories,
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
