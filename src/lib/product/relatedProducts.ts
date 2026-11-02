// /src/lib/product/relatedProducts.ts

import type { Product } from '@/lib/square/types';
import { fetchCategoryHierarchy } from '@/lib/square/categories';

/**
 * Configuration for related products algorithm
 */
export interface RelatedProductsConfig {
  maxResults: number;
  excludeOutOfStock?: boolean;
}

/**
 * Result from related products search
 */
export interface RelatedProductsResult {
  products: Product[];
  /** Each product's relationship score, parallel to `products` (see RELATION_SCORE). */
  scores: number[];
  matchType:
    'brand-category' | 'category-only' | 'brand-only' | 'complementary';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * How strongly a candidate relates to the source product. The tiers are kept
 * as named constants because callers describe a result by which tiers it
 * contains (see describeRelatedSection).
 */
export const RELATION_SCORE = {
  BRAND_AND_COMPLEMENTARY: 100,
  BRAND_AND_CATEGORY: 80,
  COMPLEMENTARY: 60,
  CATEGORY: 40,
  BRAND: 20,
} as const;

/**
 * Complementary category mapping for skateboard products
 * Maps primary categories to related categories that complete a setup cSpell:ignore griptape
 */
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

/**
 * Build a flat category-ID → slug map from the category hierarchy,
 * so real Square category IDs on a product can be resolved to the
 * human-readable slugs COMPLEMENTARY_CATEGORIES is keyed by.
 */
async function buildCategoryIdToSlugMap(): Promise<Record<string, string>> {
  const hierarchy = await fetchCategoryHierarchy();
  const idToSlug: Record<string, string> = {};

  for (const { category, subcategories } of hierarchy) {
    idToSlug[category.id] = category.slug;
    for (const subcategory of subcategories) {
      idToSlug[subcategory.id] = subcategory.slug;
    }
  }

  return idToSlug;
}

/**
 * Resolve a product's category slug from its real category fields
 * (Square category IDs), preferring its reporting category.
 */
function resolveCategorySlug(
  product: Product,
  idToSlug: Record<string, string>
): string | undefined {
  if (product.reportingCategoryId && idToSlug[product.reportingCategoryId]) {
    return idToSlug[product.reportingCategoryId];
  }

  const firstCategoryId = product.categories?.[0];
  if (firstCategoryId && idToSlug[firstCategoryId]) {
    return idToSlug[firstCategoryId];
  }

  return undefined;
}

/**
 * Score a product based on its relationship to the source product
 * Scoring system:
 * - Same brand + complementary category: 100 points
 * - Same brand + same category: 80 points
 * - Complementary category only: 60 points
 * - Same category only: 40 points
 * - Same brand only: 20 points
 */
function scoreProduct(
  sourceProduct: Product,
  candidateProduct: Product,
  sourceCategorySlug?: string,
  candidateCategorySlug?: string
): number {
  let score = 0;

  const sameBrand =
    sourceProduct.brand &&
    candidateProduct.brand &&
    sourceProduct.brand.toLowerCase() === candidateProduct.brand.toLowerCase();

  const sameCategory =
    sourceCategorySlug &&
    candidateCategorySlug &&
    sourceCategorySlug === candidateCategorySlug;

  const isComplementary =
    sourceCategorySlug &&
    candidateCategorySlug &&
    COMPLEMENTARY_CATEGORIES[sourceCategorySlug]?.includes(
      candidateCategorySlug
    );

  // Calculate score
  if (sameBrand && isComplementary) {
    score = RELATION_SCORE.BRAND_AND_COMPLEMENTARY;
  } else if (sameBrand && sameCategory) {
    score = RELATION_SCORE.BRAND_AND_CATEGORY;
  } else if (isComplementary) {
    score = RELATION_SCORE.COMPLEMENTARY;
  } else if (sameCategory) {
    score = RELATION_SCORE.CATEGORY;
  } else if (sameBrand) {
    score = RELATION_SCORE.BRAND;
  }

  return score;
}

/**
 * Get related products for a given product
 * @param sourceProduct The product to find related products for
 * @param allProducts All available products to search through
 * @param config Configuration options
 * @returns RelatedProductsResult
 */
export async function getRelatedProducts(
  sourceProduct: Product,
  allProducts: Product[],
  config: RelatedProductsConfig = { maxResults: 6 }
): Promise<RelatedProductsResult> {
  const idToSlug = await buildCategoryIdToSlugMap();
  const sourceCategorySlug = resolveCategorySlug(sourceProduct, idToSlug);

  // Score and filter products
  const scoredProducts = allProducts
    .filter((p) => {
      // Exclude the source product
      if (p.id === sourceProduct.id) return false;

      // Optionally exclude out of stock products
      if (config.excludeOutOfStock && !p.variations?.some((v) => v.inStock)) {
        return false;
      }

      return true;
    })
    .map((product) => ({
      product,
      score: scoreProduct(
        sourceProduct,
        product,
        sourceCategorySlug,
        resolveCategorySlug(product, idToSlug)
      ),
    }))
    .filter(({ score }) => score > 0) // Only keep products with a relationship
    .sort((a, b) => b.score - a.score) // Sort by score descending
    .slice(0, config.maxResults); // Limit results

  // Determine match type and confidence
  let matchType: RelatedProductsResult['matchType'] = 'complementary';
  let confidence: RelatedProductsResult['confidence'] = 'low';

  if (scoredProducts.length > 0) {
    const topScore = scoredProducts[0].score;

    if (topScore === 100) {
      matchType = 'brand-category';
      confidence = 'high';
    } else if (topScore >= 80) {
      matchType = 'brand-category';
      confidence = 'high';
    } else if (topScore >= 60) {
      matchType = 'complementary';
      confidence = 'medium';
    } else if (topScore >= 40) {
      matchType = 'category-only';
      confidence = 'medium';
    } else {
      matchType = 'brand-only';
      confidence = 'low';
    }
  }

  return {
    products: scoredProducts.map(({ product }) => product),
    scores: scoredProducts.map(({ score }) => score),
    matchType,
    confidence,
  };
}

/**
 * Get complementary categories for a given category
 * Useful for understanding product relationships
 */
export function getComplementaryCategories(categorySlug: string): string[] {
  return COMPLEMENTARY_CATEGORIES[categorySlug] || [];
}

/**
 * A section heading and "see all" destination that honestly describe a
 * related-products result.
 *
 * The result is a ranked blend (brand + category matches first, then weaker
 * ones, up to the cap), so a heading can only claim what every item in it
 * satisfies. Anything mixed gets the neutral heading and the whole shop.
 */
export interface RelatedSection {
  title: string;
  seeAll: { href: string; label: string };
}

const COMPLEMENTARY_SCORES: number[] = [
  RELATION_SCORE.BRAND_AND_COMPLEMENTARY,
  RELATION_SCORE.COMPLEMENTARY,
];
const SAME_CATEGORY_SCORES: number[] = [
  RELATION_SCORE.BRAND_AND_CATEGORY,
  RELATION_SCORE.CATEGORY,
];

/**
 * @param category The source product's most specific category, if it has one
 *   (e.g. from the breadcrumb path). Omit it when it has none.
 */
export function describeRelatedSection(
  source: Pick<Product, 'brand'>,
  result: Pick<RelatedProductsResult, 'products' | 'scores'>,
  category?: { name: string; url: string }
): RelatedSection {
  const { products, scores } = result;
  const brand = source.brand?.trim();
  const shop = { href: '/shop/all', label: 'See all products' };

  if (!products.length) return { title: 'You Might Also Like', seeAll: shop };

  // Every item is the source's brand: say so, and link to that brand
  if (
    brand &&
    products.every((p) => p.brand?.toLowerCase() === brand.toLowerCase())
  ) {
    return {
      title: `More from ${brand}`,
      seeAll: {
        href: `/shop/all?brands=${encodeURIComponent(brand)}`,
        label: `See all from ${brand}`,
      },
    };
  }

  // Every item completes a setup (trucks and wheels for a deck, ...). Their
  // category isn't the source's, so "see all" can't be the source's category.
  if (scores.every((s) => COMPLEMENTARY_SCORES.includes(s))) {
    return { title: 'Complete Your Setup', seeAll: shop };
  }

  // Every item is in the source's own category
  if (category && scores.every((s) => SAME_CATEGORY_SCORES.includes(s))) {
    return {
      title: `More in ${category.name}`,
      seeAll: { href: category.url, label: `See all ${category.name}` },
    };
  }

  return { title: 'You Might Also Like', seeAll: shop };
}

/** Every variation ID a product can be bought as (its default, if it lists none). */
export function variationIdsOf(
  product: Pick<Product, 'variationId' | 'variations'>
): string[] {
  const ids = (product.variations ?? []).map((v) => v.variationId);
  return ids.length ? [...new Set(ids)] : [product.variationId];
}

/**
 * Whether a product is sold out: every one of its variations is.
 *
 * A product with one sold-out variation (often its default, the first size)
 * and others in stock is still buyable, so judging by the default alone
 * mislabels it. Stock that couldn't be looked up counts as not sold out,
 * matching the inventory service's policy of keeping such products visible.
 */
export function isProductSoldOut(
  product: Pick<Product, 'variationId' | 'variations'>,
  inventory: Map<string, { isOutOfStock: boolean }>
): boolean {
  const ids = variationIdsOf(product);
  return (
    ids.length > 0 &&
    ids.every((id) => inventory.get(id)?.isOutOfStock === true)
  );
}
