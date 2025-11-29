// src/lib/square/clientFilterEngine.ts
// PHASE 2: Client-side filter engine using lightweight metadata
import type { FilterMetadata, FilterMetadataResponse } from "@/pages/api/filter-metadata";

export interface ClientFilterState {
  brands: string[];
  availability: boolean;
}

export class ClientFilterEngine {
  private metadata: FilterMetadata[] = [];
  private allBrands: string[] = [];
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  constructor(private categoryId?: string) {}

  // Load metadata from API
  // PHASE 4: Check for SSR-injected metadata first for instant loading
  async loadMetadata(): Promise<void> {
    // Return existing promise if already loading
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // Return immediately if already loaded
    if (this.isLoaded) {
      return Promise.resolve();
    }

    this.loadPromise = (async () => {
      try {
        // PHASE 4: Check for SSR-injected metadata first
        const windowWithMetadata = window as any;
        if (windowWithMetadata.__FILTER_METADATA__) {
          console.log(
            "[ClientFilterEngine] 🚀 PHASE 4: Using SSR-injected metadata (instant!)"
          );

          const data = windowWithMetadata.__FILTER_METADATA__;
          this.metadata = data.products;
          this.allBrands = data.brands;
          this.isLoaded = true;

          console.log(
            `[ClientFilterEngine] ✅ Loaded ${this.metadata.length} products, ${this.allBrands.length} brands from SSR`
          );

          // Clean up to free memory
          delete windowWithMetadata.__FILTER_METADATA__;

          return;
        }

        // Fallback: Fetch from API if no SSR data
        console.log(
          "[ClientFilterEngine] 📡 No SSR metadata, fetching from API..."
        );

        const url = this.categoryId
          ? `/api/filter-metadata?category=${this.categoryId}`
          : "/api/filter-metadata";

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to fetch metadata: ${response.status}`);
        }

        const data: FilterMetadataResponse = await response.json();

        this.metadata = data.products;
        this.allBrands = data.brands;
        this.isLoaded = true;

        console.log(
          `[ClientFilterEngine] ✅ Loaded ${this.metadata.length} products, ${this.allBrands.length} brands from API`
        );
      } catch (error) {
        console.error("[ClientFilterEngine] Failed to load metadata:", error);
        throw error;
      }
    })();

    return this.loadPromise;
  }

  // Get filtered product IDs based on current filters
  getFilteredProductIds(filters: ClientFilterState): string[] {
    if (!this.isLoaded) {
      console.warn("[ClientFilterEngine] Metadata not loaded yet");
      return [];
    }

    let filtered = [...this.metadata];

    // Brand filtering
    if (filters.brands.length > 0) {
      filtered = filtered.filter((p) =>
        p.brand ? filters.brands.includes(p.brand) : false
      );
    }

    // Availability filtering
    if (filters.availability) {
      filtered = filtered.filter((p) => p.isInStock);
    }

    return filtered.map((p) => p.id);
  }

  // Get all available brands
  getBrands(): string[] {
    return this.allBrands;
  }

  // Check if metadata is loaded
  isReady(): boolean {
    return this.isLoaded;
  }

  // Get metadata for a specific product
  getProductMetadata(productId: string): FilterMetadata | undefined {
    return this.metadata.find((p) => p.id === productId);
  }

  // Get total product count
  getTotalCount(): number {
    return this.metadata.length;
  }

  // Get filtered count
  getFilteredCount(filters: ClientFilterState): number {
    return this.getFilteredProductIds(filters).length;
  }
}

// Singleton instance management
const engineCache = new Map<string, ClientFilterEngine>();

export function getFilterEngine(categoryId?: string): ClientFilterEngine {
  const key = categoryId || "all";

  if (!engineCache.has(key)) {
    engineCache.set(key, new ClientFilterEngine(categoryId));
  }

  return engineCache.get(key)!;
}
