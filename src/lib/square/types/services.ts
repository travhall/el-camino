// src/lib/square/types/services.ts

import type { Product } from "../types";

/**
 * Service-specific types
 */

export interface ProductServiceOptions {
  locationId: string;
}

export interface InventoryServiceOptions {
  locationId: string;
}

export interface BulkInventoryResult {
  [variationId: string]: number;
}

export interface InventoryUpdateEvent {
  catalogObjectId: string;
  quantity: number;
}
