// /src/utils/generateSkuReference.ts
// Utility to generate human-readable SKU reference for content creators

import { fetchProducts } from "@/lib/square/client";
import type { Product } from "@/lib/square/types";

export interface SkuReference {
  humanReadableSku: string;
  actualSku?: string;
  title: string;
  brand?: string;
  price: number;
  category: string; // Derived from title/brand
  id: string; // For fallback compatibility
}

/**
 * Generate a comprehensive SKU reference guide for content creators
 */
export async function generateSkuReference(): Promise<{
  success: boolean;
  skus: SkuReference[];
  categorized: Record<string, SkuReference[]>;
  error?: string;
}> {
  try {
    const products = await fetchProducts();
    
    if (!products || products.length === 0) {
      return {
        success: false,
        skus: [],
        categorized: {},
        error: "No products found"
      };
    }

    // Convert products to SKU references
    const skus: SkuReference[] = products
      .filter(product => product.humanReadableSku) // Only include products with generated SKUs
      .map(product => ({
        humanReadableSku: product.humanReadableSku!,
        actualSku: product.sku,
        title: product.title,
        brand: product.brand,
        price: product.price,
        category: categorizeProduct(product),
        id: product.id
      }));

    // Group by category for easier browsing
    const categorized = skus.reduce((acc, sku) => {
      const category = sku.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(sku);
      return acc;
    }, {} as Record<string, SkuReference[]>);

    // Sort within each category
    Object.keys(categorized).forEach(category => {
      categorized[category].sort((a, b) => a.humanReadableSku.localeCompare(b.humanReadableSku));
    });

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
 * Categorize products for easier browsing
 */
function categorizeProduct(product: Product): string {
  const title = product.title.toLowerCase();
  const brand = product.brand?.toLowerCase() || '';

  // Skateboard decks
  if (title.includes('deck') || title.includes('board')) {
    return 'Decks';
  }

  // Trucks & Hardware
  if (title.includes('truck') || title.includes('trucks')) {
    return 'Trucks';
  }

  // Wheels & Bearings
  if (title.includes('wheel') || title.includes('wheels') || title.includes('bearing')) {
    return 'Wheels & Bearings';
  }

  // Apparel
  if (title.includes('shirt') || title.includes('hoody') || title.includes('hoodie') || 
      title.includes('sweatshirt') || title.includes('tee') || title.includes('crewneck')) {
    return 'Apparel - Tops';
  }

  if (title.includes('pant') || title.includes('short') || title.includes('jean')) {
    return 'Apparel - Bottoms';
  }

  // Accessories
  if (title.includes('hat') || title.includes('cap') || title.includes('beanie')) {
    return 'Accessories - Headwear';
  }

  if (title.includes('sock') || title.includes('socks')) {
    return 'Accessories - Socks';
  }

  if (title.includes('bag') || title.includes('backpack') || title.includes('tote')) {
    return 'Accessories - Bags';
  }

  // Tools & Hardware
  if (title.includes('tool') || title.includes('wrench') || title.includes('key')) {
    return 'Tools & Hardware';
  }

  // Collectibles & Media
  if (title.includes('vinyl') || title.includes('book') || title.includes('poster')) {
    return 'Collectibles & Media';
  }

  // Default categorization by brand
  if (brand) {
    return `${brand.charAt(0).toUpperCase()}${brand.slice(1)} Products`;
  }

  return 'Other Products';
}

/**
 * Generate markdown documentation for content creators
 */
export function generateSkuMarkdown(categorized: Record<string, SkuReference[]>): string {
  let markdown = `# Product SKU Reference Guide\n\n`;
  markdown += `*Generated automatically from Square catalog*\n\n`;
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
  markdown += `*Last updated: ${new Date().toLocaleDateString()}*\n`;
  
  return markdown;
}
