// src/utils/slugUtils.ts
import type { Product, ProductVariation } from "@/lib/square/types";

/**
 * Create URL-safe slug from product title
 */
export function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Remove duplicate hyphens
    .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length for URLs
}

/**
 * Create variant slug from variation name
 */
export function createVariantSlug(variantName: string): string {
  return variantName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") // Remove punctuation
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Remove duplicate hyphens
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Create complete product URL
 */
export function createProductUrl(product: Pick<Product, "title">): string {
  return `/product/${createSlug(product.title)}`;
}

/**
 * Extract Square catalog ID from slug parameter
 * Handles both old (ID-only) and new (slug) formats
 */
export function extractIdFromSlug(
  slug: string,
  productMapping: Map<string, string>
): string | null {
  // For old format (direct IDs), return as-is if it looks like Square ID
  if (slug.match(/^[A-Z0-9]{24,}$/)) {
    return slug;
  }

  // For new format, lookup in provided mapping
  return productMapping.get(slug) || null;
}

/**
 * Create slug-to-ID mapping from products
 */
export function createSlugMapping(products: Product[]): Map<string, string> {
  const mapping = new Map<string, string>();

  products.forEach((product) => {
    const slug = createSlug(product.title);

    // Handle potential duplicates by appending counter
    let uniqueSlug = slug;
    let counter = 1;
    while (mapping.has(uniqueSlug)) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    mapping.set(uniqueSlug, product.id);
  });

  return mapping;
}

/**
 * Extract variation from variant parameter
 */
export function getVariationFromVariantParam(
  product: Product,
  variantParam: string
): ProductVariation | undefined {
  if (!product.variations || !variantParam) {
    return undefined;
  }

  return product.variations.find(
    (v) => createVariantSlug(v.name) === variantParam
  );
}

/**
 * Create SEO-friendly page title
 */
export function createSEOTitle(
  product: Product,
  variation?: ProductVariation
): string {
  let title = product.title;

  if (product.brand) {
    title = `${product.brand} ${title}`;
  }

  if (variation && variation.name && variation.name !== product.title) {
    title = `${title} - ${variation.name}`;
  }

  return `${title} | El Camino`;
}
