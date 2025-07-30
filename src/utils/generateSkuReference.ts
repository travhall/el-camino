// /src/utils/generateSkuReference.ts
// FIXED: Now uses actual Square categories instead of derived ones

import { fetchProducts } from "@/lib/square/client";
import { fetchCategoryHierarchy } from "@/lib/square/categories";
import { squareClient } from "@/lib/square/client";
import type { Product } from "@/lib/square/types";
import type { CategoryHierarchy } from "@/lib/square/types";

export interface SkuReference {
  humanReadableSku: string;
  actualSku?: string;
  title: string;
  brand?: string;
  price: number;
  category: string; // Now uses actual Square categories
  subcategory?: string; // For subcategories within main categories
  id: string; // For fallback compatibility
  categoryId?: string; // Square category ID for reference
  subcategoryId?: string; // Square subcategory ID if applicable
}

/**
 * Generate a comprehensive SKU reference guide using actual Square categories
 */
export async function generateSkuReference(): Promise<{
  success: boolean;
  skus: SkuReference[];
  categorized: Record<string, SkuReference[]>;
  error?: string;
}> {
  try {
    console.log('[generateSkuReference] Starting with actual Square categories...');
    
    // Fetch products and categories in parallel
    const [products, categoryHierarchy] = await Promise.all([
      fetchProducts(),
      fetchCategoryHierarchy()
    ]);
    
    if (!products || products.length === 0) {
      return {
        success: false,
        skus: [],
        categorized: {},
        error: "No products found"
      };
    }

    if (!categoryHierarchy || categoryHierarchy.length === 0) {
      console.warn('[generateSkuReference] No categories found, using fallback categorization');
    }

    console.log(`[generateSkuReference] Processing ${products.length} products with ${categoryHierarchy.length} categories`);

    // Build category lookup maps for efficient matching
    const categoryMap = new Map<string, string>(); // id -> name
    const subcategoryMap = new Map<string, { name: string; parentName: string }>(); // id -> { name, parentName }
    
    categoryHierarchy.forEach(hierarchy => {
      categoryMap.set(hierarchy.category.id, hierarchy.category.name);
      
      hierarchy.subcategories.forEach(subcategory => {
        subcategoryMap.set(subcategory.id, {
          name: subcategory.name,
          parentName: hierarchy.category.name
        });
      });
    });

    // Get product-to-category mappings by searching for each product
    const productCategoryMappings = await getProductCategoryMappings(products);

    // Convert products to SKU references with actual Square categories
    const skus: SkuReference[] = products
      .filter(product => product.humanReadableSku) // Only include products with generated SKUs
      .map(product => {
        const categoryInfo = productCategoryMappings.get(product.id);
        let category = 'Uncategorized';
        let subcategory: string | undefined;
        let categoryId: string | undefined;
        let subcategoryId: string | undefined;

        if (categoryInfo) {
          categoryId = categoryInfo.categoryId;
          
          // Check if it's a subcategory first
          const subcategoryInfo = subcategoryMap.get(categoryInfo.categoryId);
          if (subcategoryInfo) {
            category = subcategoryInfo.parentName;
            subcategory = subcategoryInfo.name;
            subcategoryId = categoryInfo.categoryId;
          } else {
            // It's a top-level category
            const topLevelName = categoryMap.get(categoryInfo.categoryId);
            if (topLevelName) {
              category = topLevelName;
            }
          }
        } else {
          // Fallback to product title-based categorization if no Square category found
          category = fallbackCategorizeProduct(product);
        }

        return {
          humanReadableSku: product.humanReadableSku!,
          actualSku: product.sku,
          title: product.title,
          brand: product.brand,
          price: product.price,
          category: category,
          subcategory: subcategory,
          id: product.id,
          categoryId: categoryId,
          subcategoryId: subcategoryId
        };
      });

    // Group by category, preserving Square hierarchy
    const categorized = skus.reduce((acc, sku) => {
      const categoryKey = sku.subcategory ? 
        `${sku.category} > ${sku.subcategory}` : 
        sku.category;
      
      if (!acc[categoryKey]) {
        acc[categoryKey] = [];
      }
      acc[categoryKey].push(sku);
      return acc;
    }, {} as Record<string, SkuReference[]>);

    // Sort within each category
    Object.keys(categorized).forEach(category => {
      categorized[category].sort((a, b) => a.humanReadableSku.localeCompare(b.humanReadableSku));
    });

    console.log(`[generateSkuReference] Successfully categorized ${skus.length} products into ${Object.keys(categorized).length} categories`);

    return {
      success: true,
      skus: skus.sort((a, b) => a.humanReadableSku.localeCompare(b.humanReadableSku)),
      categorized,
    };
  } catch (error) {
    console.error('Error generating SKU reference:', error);
    return {
      success: false,
      skus: [],
      categorized: {},
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get category assignments for products by searching Square catalog
 * Handles both legacy categoryId and modern categories array
 */
async function getProductCategoryMappings(products: Product[]): Promise<Map<string, { categoryId: string }>> {
  const mappings = new Map<string, { categoryId: string }>();
  
  try {
    // Use Square's catalog API to get all items with their category information
    const { result } = await squareClient.catalogApi.listCatalog(undefined, "ITEM");
    
    if (result?.objects) {
      result.objects.forEach(item => {
        if (item.type === "ITEM") {
          let categoryId: string | undefined;
          
          // Method 1: Use new categories array (preferred)
          if (item.itemData?.categories && item.itemData.categories.length > 0) {
            // Take the first category if multiple exist
            categoryId = item.itemData.categories[0].id;
          }
          // Method 2: Fall back to deprecated categoryId field
          else if (item.itemData?.categoryId) {
            categoryId = item.itemData.categoryId;
          }
          
          if (categoryId) {
            mappings.set(item.id, { categoryId });
          }
        }
      });
    }
    
    console.log(`[getProductCategoryMappings] Found category mappings for ${mappings.size} products`);
    
  } catch (error) {
    console.warn('Failed to fetch product category mappings:', error);
    
    // Fallback: Try alternative approach using search
    try {
      console.log('[getProductCategoryMappings] Trying alternative search approach...');
      
      const searchResponse = await squareClient.catalogApi.searchCatalogObjects({
        objectTypes: ["ITEM"],
        includeRelatedObjects: true
      });
      
      if (searchResponse.result?.objects) {
        searchResponse.result.objects.forEach(item => {
          if (item.type === "ITEM") {
            let categoryId: string | undefined;
            
            if (item.itemData?.categories && item.itemData.categories.length > 0) {
              categoryId = item.itemData.categories[0].id;
            } else if (item.itemData?.categoryId) {
              categoryId = item.itemData.categoryId;
            }
            
            if (categoryId) {
              mappings.set(item.id, { categoryId });
            }
          }
        });
      }
      
      console.log(`[getProductCategoryMappings] Alternative search found ${mappings.size} category mappings`);
      
    } catch (searchError) {
      console.warn('Alternative search also failed:', searchError);
    }
  }
  
  return mappings;
}

/**
 * Fallback categorization when Square categories aren't available
 * This matches the original logic but now only used as fallback
 */
function fallbackCategorizeProduct(product: Product): string {
  const title = product.title.toLowerCase();
  const brand = product.brand?.toLowerCase() || '';

  // Skateboard decks
  if (title.includes('deck') || title.includes('board')) {
    return 'Skateboards > Decks';
  }

  // Trucks & Hardware
  if (title.includes('truck') || title.includes('trucks')) {
    return 'Skateboards > Trucks';
  }

  // Wheels & Bearings
  if (title.includes('wheel') || title.includes('wheels')) {
    return 'Skateboards > Wheels';
  }
  
  if (title.includes('bearing')) {
    return 'Skateboards > Bearings Bolts & More';
  }

  // Apparel
  if (title.includes('shirt') || title.includes('hoody') || title.includes('hoodie') || 
      title.includes('sweatshirt') || title.includes('tee') || title.includes('crewneck')) {
    return 'Apparel > Tees & Tops';
  }

  if (title.includes('pant') || title.includes('short') || title.includes('jean')) {
    return 'Apparel > Bottoms';
  }

  // Accessories
  if (title.includes('hat') || title.includes('cap') || title.includes('beanie')) {
    return 'Apparel > Hats';
  }

  if (title.includes('sock') || title.includes('socks')) {
    return 'Apparel > Accessories';
  }

  if (title.includes('bag') || title.includes('backpack') || title.includes('tote')) {
    return 'Apparel > Accessories';
  }

  // Tools & Hardware
  if (title.includes('tool') || title.includes('wrench') || title.includes('key')) {
    return 'Skateboards > Bearings Bolts & More';
  }

  // Default to brand if available, otherwise uncategorized
  if (brand) {
    return `${brand.charAt(0).toUpperCase()}${brand.slice(1)} Products`;
  }

  return 'Uncategorized';
}

/**
 * Generate markdown documentation for content creators
 */
export function generateSkuMarkdown(categorized: Record<string, SkuReference[]>): string {
  let markdown = `# Product SKU Reference Guide\n\n`;
  markdown += `*Generated automatically from Square catalog with actual category structure*\n\n`;
  markdown += `Use these human-readable SKUs in your WordPress content:\n\n`;
  markdown += `\`\`\`html\n`;
  markdown += `<div class="wp-block-product-showcase" \n`;
  markdown += `     data-product-skus="SPITFIRE-CLASSIC-SOCKS,THRASHER-THORNS-HOODY"\n`;
  markdown += `     data-title="Featured Products">\n`;
  markdown += `</div>\n`;
  markdown += `\`\`\`\n\n`;

  Object.entries(categorized).forEach(([category, skus]) => {
    markdown += `## ${category}\n\n`;
    markdown += `| SKU | Product | Price | Brand |\n`;
    markdown += `|-----|---------|-------|-------|\n`;
    
    skus.forEach(sku => {
      const price = `$${sku.price.toFixed(2)}`;
      const brand = sku.brand || 'N/A';
      markdown += `| \`${sku.humanReadableSku}\` | ${sku.title} | ${price} | ${brand} |\n`;
    });
    
    markdown += `\n`;
  });

  markdown += `---\n\n`;
  markdown += `*Categories reflect actual Square catalog structure*\n`;
  markdown += `*Last updated: ${new Date().toLocaleDateString()}*\n`;
  
  return markdown;
}