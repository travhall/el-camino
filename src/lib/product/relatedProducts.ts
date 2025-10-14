// /src/lib/product/relatedProducts.ts

import type { Product } from "@/lib/square/types";

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
  matchType: 'brand-category' | 'category-only' | 'brand-only' | 'complementary';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Complementary category mapping for skateboard products
 * Maps primary categories to related categories that complete a setup
 */
const COMPLEMENTARY_CATEGORIES: Record<string, string[]> = {
  'decks': ['trucks', 'wheels', 'bearings', 'hardware', 'grip-tape', 'griptape'],
  'trucks': ['decks', 'wheels', 'bearings', 'hardware'],
  'wheels': ['trucks', 'bearings', 'bearings-spacers'],
  'bearings': ['decks', 'trucks', 'wheels'],
  'hardware': ['decks', 'trucks'],
  'grip-tape': ['decks'],
  'griptape': ['decks'],
  'apparel': ['footwear', 'accessories'],
  'footwear': ['apparel', 'accessories', 'insoles'],
  'accessories': ['apparel', 'footwear'],
};

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
  sourceCategorySlug?: string
): number {
  let score = 0;
  
  const sameBrand = sourceProduct.brand && 
    candidateProduct.brand && 
    sourceProduct.brand.toLowerCase() === candidateProduct.brand.toLowerCase();
  
  // Extract category slug from URL (e.g., /category/decks/product-slug)
  const candidateCategoryMatch = candidateProduct.url.match(/\/category\/([^\/]+)/);
  const candidateCategorySlug = candidateCategoryMatch ? candidateCategoryMatch[1] : undefined;
  
  const sameCategory = sourceCategorySlug && candidateCategorySlug &&
    sourceCategorySlug === candidateCategorySlug;
  
  const isComplementary = sourceCategorySlug && candidateCategorySlug &&
    COMPLEMENTARY_CATEGORIES[sourceCategorySlug]?.includes(candidateCategorySlug);
  
  // Calculate score
  if (sameBrand && isComplementary) {
    score = 100;
  } else if (sameBrand && sameCategory) {
    score = 80;
  } else if (isComplementary) {
    score = 60;
  } else if (sameCategory) {
    score = 40;
  } else if (sameBrand) {
    score = 20;
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
  // Extract source category from URL
  const sourceCategoryMatch = sourceProduct.url.match(/\/category\/([^\/]+)/);
  const sourceCategorySlug = sourceCategoryMatch ? sourceCategoryMatch[1] : undefined;
  
  // Score and filter products
  const scoredProducts = allProducts
    .filter(p => {
      // Exclude the source product
      if (p.id === sourceProduct.id) return false;
      
      // Optionally exclude out of stock products
      if (config.excludeOutOfStock && !p.variations?.some(v => v.inStock)) {
        return false;
      }
      
      return true;
    })
    .map(product => ({
      product,
      score: scoreProduct(sourceProduct, product, sourceCategorySlug)
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
    matchType,
    confidence
  };
}

/**
 * Get complementary categories for a given category
 * Useful for understanding product relationships
 */
export function getComplementaryCategories(categorySlug: string): string[] {
  return COMPLEMENTARY_CATEGORIES[categorySlug] || [];
}
