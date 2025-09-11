// src/env.d.ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  // Square
  readonly SQUARE_ACCESS_TOKEN: string;
  readonly PUBLIC_SQUARE_APP_ID: string;
  readonly PUBLIC_SQUARE_LOCATION_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Fix JSX IntrinsicElements error
declare global {
  namespace JSX {
    type Element = astroHTML.JSX.Element;
    type IntrinsicElements = astroHTML.JSX.IntrinsicElements;
  }

  // Performance optimization console commands (Phase 4)
  interface Window {
    // Smart Cache Manager
    smartCacheManager?: {
      getCacheStats(): {
        invalidations: number;
        lastInvalidation: number;
        criticalUpdates: number;
        cacheVersion: number;
        lastInventoryUpdate: number;
        timeSinceLastUpdate: number;
      };
      forceInvalidation(reason?: string): Promise<void>;
      shouldInvalidateCache(lastUpdate: number, threshold?: number): boolean;
    };

    // Phase 4 Console Commands
    smartCache?: () => {
      invalidations: number;
      lastInvalidation: number;
      criticalUpdates: number;
      cacheVersion: number;
      lastInventoryUpdate: number;
      timeSinceLastUpdate: number;
    };
    invalidateCache?: (reason?: string) => Promise<void>;
    checkCacheHealth?: () => {
      cacheVersion: number;
      timeSinceLastUpdate: number;
      totalInvalidations: number;
      needsInvalidation: boolean;
      status: string;
    };

    // Phase 1-3 Console Commands (existing)
    cacheReport?: () => any;
    exportCacheData?: () => any;
    clearCacheData?: () => void;
    cacheStats?: () => any;
    cacheMonitor?: {
      getStats(): any;
      exportData(): any;
    };
  }
}
