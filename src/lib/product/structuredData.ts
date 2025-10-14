// /src/lib/product/structuredData.ts

import type { Product, ProductVariation } from "@/lib/square/types";
import { siteConfig } from "@/lib/site-config";

/**
 * Product Schema.org structured data
 */
export interface ProductSchema {
  "@context": "https://schema.org";
  "@type": "Product";
  name: string;
  image: string | string[];
  description?: string;
  brand?: {
    "@type": "Brand";
    name: string;
  };
  offers: {
    "@type": "Offer";
    url: string;
    priceCurrency: string;
    price: string;
    availability: string;
    itemCondition: string;
  };
  sku?: string;
}

/**
 * Generate Product structured data for JSON-LD
 */
export function generateProductSchema(
  product: Product,
  selectedVariation?: ProductVariation,
  baseUrl: string = siteConfig.url
): ProductSchema {
  const variation = selectedVariation || product.variations?.[0];
  const price = variation?.price || product.price;
  const inStock = variation?.inStock ?? true;

  // Availability mapping
  const availability = inStock
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";

  // Build full URL
  const productUrl = `${baseUrl}${product.url}`;

  // Build image URL (ensure absolute)
  const imageUrl = product.image.startsWith("http")
    ? product.image
    : `${baseUrl}${product.image}`;

  const schema: ProductSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: imageUrl,
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "USD",
      price: price.toFixed(2),
      availability,
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  // Add optional fields
  if (product.description) {
    schema.description = product.description;
  }

  if (product.brand) {
    schema.brand = {
      "@type": "Brand",
      name: product.brand,
    };
  }

  if (product.sku || variation?.sku) {
    schema.sku = variation?.sku || product.sku;
  }

  return schema;
}

/**
 * Open Graph meta tags data
 */
export interface OGData {
  title: string;
  description: string;
  image: string;
  url: string;
  type: string;
  siteName: string;
  price?: string;
  currency?: string;
  availability?: string;
}

/**
 * Generate Open Graph tags data
 */
export function generateOGData(
  product: Product,
  selectedVariation?: ProductVariation,
  baseUrl: string = siteConfig.url
): OGData {
  const variation = selectedVariation || product.variations?.[0];
  const price = variation?.price || product.price;
  const inStock = variation?.inStock ?? true;

  const productUrl = `${baseUrl}${product.url}`;
  const imageUrl = product.image.startsWith("http")
    ? product.image
    : `${baseUrl}${product.image}`;

  // Build title with brand
  const title = product.brand
    ? `${product.brand} ${product.title}`
    : product.title;

  // Build description
  const description =
    product.description ||
    `${title} - Available at El Camino Skate Shop in Eau Claire, WI`;

  return {
    title,
    description,
    image: imageUrl,
    url: productUrl,
    type: "product",
    siteName: "El Camino Skate Shop",
    price: price.toFixed(2),
    currency: "USD",
    availability: inStock ? "in stock" : "out of stock",
  };
}

/**
 * Twitter Card meta tags data
 */
export interface TwitterCardData {
  card: string;
  title: string;
  description: string;
  image: string;
}

/**
 * Generate Twitter Card data
 */
export function generateTwitterCardData(
  product: Product,
  baseUrl: string = siteConfig.url
): TwitterCardData {
  const imageUrl = product.image.startsWith("http")
    ? product.image
    : `${baseUrl}${product.image}`;

  const title = product.brand
    ? `${product.brand} ${product.title}`
    : product.title;

  const description =
    product.description || `${title} - Available at El Camino Skate Shop`;

  return {
    card: "summary_large_image",
    title,
    description,
    image: imageUrl,
  };
}
