// /src/lib/product/breadcrumbs.ts

import type { Product, Category } from "@/lib/square/types";
import { siteConfig } from "@/lib/site-config";

/**
 * Breadcrumb item for navigation
 */
export interface BreadcrumbItem {
  name: string;
  url: string;
  position: number;
}

/**
 * Complete breadcrumb path with structured data
 */
export interface BreadcrumbPath {
  items: BreadcrumbItem[];
  structuredData: object;
}

/**
 * Find which category a product belongs to, using product.categories (Square
 * category IDs already present on the product) instead of reverse-scanning
 * every category's product list via the API.
 * Returns the most specific (deepest) category the product belongs to.
 */
function findProductCategory(product: Product, categories: Category[]): Category | null {
  let foundCategory: Category | null = null;

  // Prefer subcategories (non-top-level) over top-level categories for specificity
  for (const categoryId of product.categories ?? []) {
    const category = categories.find(c => c.id === categoryId);
    if (!category) continue;
    if (!foundCategory || (!foundCategory.parentCategoryId && category.parentCategoryId)) {
      foundCategory = category;
    }
  }
  return foundCategory;
}

/**
 * Generate breadcrumb path for a product
 * Pattern: Home > Category > Subcategory > Brand > Product
 */
export async function generateBreadcrumbs(
  product: Product,
  categories: Category[],
  baseUrl: string = siteConfig.url
): Promise<BreadcrumbPath> {
  const items: BreadcrumbItem[] = [
    { name: 'Home', url: '/', position: 1 }
  ];

  // Find which category this product belongs to (most specific)
  const productCategory = findProductCategory(product, categories);
  
  if (productCategory) {
    // Build category hierarchy from root to current
    const categoryPath: Category[] = [];
    
    // If this is a subcategory, find its parent chain
    if (productCategory.parentCategoryId) {
      // Add root category
      if (productCategory.rootCategoryId) {
        const rootCat = categories.find(c => c.id === productCategory.rootCategoryId);
        if (rootCat) {
          categoryPath.push(rootCat);
        }
      }
      
      // Add parent category if different from root
      if (productCategory.parentCategoryId !== productCategory.rootCategoryId) {
        const parentCat = categories.find(c => c.id === productCategory.parentCategoryId);
        if (parentCat) {
          categoryPath.push(parentCat);
        }
      }
    }
    
    // Add current category (the most specific one)
    categoryPath.push(productCategory);
    
    // Add all categories to breadcrumb path
    categoryPath.forEach(cat => {
      items.push({
        name: cat.name,
        url: `/category/${cat.slug}`,
        position: items.length + 1
      });
    });
  }

  // Add brand if available (using correct query param: brands)
  if (product.brand) {
    items.push({
      name: product.brand,
      url: `/shop/all?brands=${encodeURIComponent(product.brand)}`,
      position: items.length + 1
    });
  }

  // Add current product (non-clickable)
  items.push({
    name: product.title,
    url: product.url,
    position: items.length + 1
  });

  // Generate JSON-LD structured data
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map(item => ({
      "@type": "ListItem",
      "position": item.position,
      "name": item.name,
      "item": `${baseUrl}${item.url}`
    }))
  };

  return {
    items,
    structuredData
  };
}
