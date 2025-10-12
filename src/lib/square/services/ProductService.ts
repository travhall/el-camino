// src/lib/square/services/ProductService.ts
import { BaseService } from "./BaseService";
import type { Client } from "square/legacy";
import type { CircuitBreaker } from "../apiUtils";
import type { Cache } from "../cacheUtils";
import type { Product } from "../types";
import type { ProductServiceOptions } from "../types/services";

/**
 * Service for product-related operations
 * Provides centralized access to product data with caching and error handling
 */
export class ProductService extends BaseService {
  private locationId: string;

  constructor(
    client: Client,
    circuitBreaker: CircuitBreaker,
    options: ProductServiceOptions,
    cache?: Cache<Product[]>
  ) {
    super(client, circuitBreaker, "ProductService", cache);
    this.locationId = options.locationId;
  }

  /**
   * Fetch all products with caching
   * This is the primary method for getting product data
   */
  async getAllProducts(): Promise<Product[]> {
    const cacheKey = `products:all:${this.locationId}`;

    return this.executeWithCache(cacheKey, async () => {
      // Import the existing fetchProducts function
      const { fetchProducts } = await import("../client");
      const products = await fetchProducts();
      console.log(
        `[ProductService] Fetched ${products.length} products from Square`
      );
      return products;
    }, "getAllProducts");
  }

  /**
   * Get a single product by ID
   */
  async getProduct(productId: string): Promise<Product | null> {
    const cacheKey = `product:${productId}`;

    return this.executeWithCache(cacheKey, async () => {
      const { fetchProduct } = await import("../client");
      const product = await fetchProduct(productId);
      console.log(
        `[ProductService] Fetched product: ${productId} ${
          product ? "✓" : "✗"
        }`
      );
      return product;
    }, "getProduct");
  }

  /**
   * Search products by human-readable SKU
   * Used by WordPress product showcases
   */
  async getProductBySku(sku: string): Promise<Product | null> {
    const allProducts = await this.getAllProducts();
    const product = allProducts.find(
      (p) =>
        p.humanReadableSku?.toLowerCase() === sku.toLowerCase() ||
        p.sku?.toLowerCase() === sku.toLowerCase()
    );

    if (product) {
      console.log(`[ProductService] Found product by SKU: ${sku}`);
    } else {
      console.log(`[ProductService] No product found for SKU: ${sku}`);
    }

    return product || null;
  }

  /**
   * Invalidate product cache (called by webhooks)
   */
  onCatalogUpdate(): void {
    console.log("[ProductService] Catalog updated, clearing cache");
    this.clearCache();
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats() {
    return {
      service: this.serviceName,
      locationId: this.locationId,
      cache: this.getCacheStats(),
    };
  }
}
