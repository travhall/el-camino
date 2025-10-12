// src/lib/square/services/index.ts
import { squareClient } from "../client";
import { defaultCircuitBreaker } from "../apiUtils";
import { Cache } from "../cacheUtils";
import { ProductService } from "./ProductService";

// Create singleton instances of services with caching

const locationId = import.meta.env.PUBLIC_SQUARE_LOCATION_ID || "";

// Product service with 10-minute cache
export const productService = new ProductService(
  squareClient,
  defaultCircuitBreaker,
  { locationId },
  new Cache("products", 600) // 10 minutes
);

// Export service instances
export { ProductService };

// Export types
export type { ProductServiceOptions } from "../types/services";
