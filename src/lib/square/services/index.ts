// src/lib/square/services/index.ts
import { squareClient } from "../client";
import { defaultCircuitBreaker } from "../apiUtils";
import { Cache } from "../cacheUtils";
import { ProductService } from "./ProductService";
import { InventoryService } from "./InventoryService";

// Create singleton instances of services with caching

const locationId = import.meta.env.PUBLIC_SQUARE_LOCATION_ID || "";

// Product service with 10-minute cache
export const productService = new ProductService(
  squareClient,
  defaultCircuitBreaker,
  { locationId },
  new Cache("products", 600) // 10 minutes
);

// Inventory service with 15-minute cache (matches existing inventoryCache)
export const inventoryService = new InventoryService(
  squareClient,
  defaultCircuitBreaker,
  { locationId },
  new Cache("inventory", 900) // 15 minutes
);

// Export service classes
export { ProductService, InventoryService };

// Export types
export type { 
  ProductServiceOptions, 
  InventoryServiceOptions,
  BulkInventoryResult,
  InventoryUpdateEvent
} from "../types/services";
