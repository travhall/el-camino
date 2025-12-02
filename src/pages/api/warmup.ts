/**
 * Function Warmup Endpoint
 * ENHANCED: Pre-warms caches to eliminate cold start on first filter selection
 *
 * Pinged every 5 minutes by GitHub Actions to:
 * 1. Keep serverless functions warm
 * 2. Pre-populate batch inventory cache
 * 3. Pre-compute common filter combinations
 *
 * Expected impact: 75% reduction in first filter lag (from 1-2s to 200-400ms)
 */

import type { APIRoute } from 'astro';
import { fetchProducts } from '@/lib/square/client';
import { filterProductsWithCache, extractFilterOptions } from '@/lib/square/filterUtils';
import { batchInventoryService } from '@/lib/square/batchInventory';

export const GET: APIRoute = async () => {
  const startTime = performance.now();
  const warmedCaches: string[] = [];
  const errors: string[] = [];

  try {
    // PHASE 1: Pre-warm batch inventory cache
    // This eliminates the Square API call on first filter selection
    try {
      const allProducts = await fetchProducts(); // Uses productCache internally
      warmedCaches.push(`products (${allProducts.length} items)`);

      // Extract all variation IDs and pre-warm batch inventory cache
      const variationIds = allProducts
        .map(p => p.variationId)
        .filter((id): id is string => Boolean(id));

      if (variationIds.length > 0) {
        const inventoryStart = performance.now();
        await batchInventoryService.getBatchInventoryStatus(variationIds);
        const inventoryDuration = performance.now() - inventoryStart;
        warmedCaches.push(`inventory (${variationIds.length} items in ${inventoryDuration.toFixed(0)}ms)`);
      }

      // PHASE 2: Pre-warm common filter combinations
      // This pre-computes and caches the most frequently used filters
      const filterStart = performance.now();
      const filterOptions = extractFilterOptions(allProducts);

      // Top 5 most popular brands (by product count)
      const topBrands = filterOptions.brands.slice(0, 5);

      // Pre-warm filter cache for common scenarios:

      // 1. No filters (baseline - all products)
      await filterProductsWithCache(allProducts, { brands: [], availability: false });
      warmedCaches.push('filter: none');

      // 2. Availability only (very common filter)
      await filterProductsWithCache(allProducts, { brands: [], availability: true });
      warmedCaches.push('filter: availability');

      // 3. Top 5 individual brands (most likely first selections)
      for (const brand of topBrands) {
        await filterProductsWithCache(
          allProducts,
          { brands: [brand.name], availability: false }
        );
        warmedCaches.push(`filter: ${brand.name}`);
      }

      // 4. Top 3 brands + availability (common combination)
      for (const brand of topBrands.slice(0, 3)) {
        await filterProductsWithCache(
          allProducts,
          { brands: [brand.name], availability: true }
        );
        warmedCaches.push(`filter: ${brand.name} + availability`);
      }

      const filterDuration = performance.now() - filterStart;
      warmedCaches.push(`filter combinations (${filterDuration.toFixed(0)}ms)`);

    } catch (error) {
      const errorMsg = `Product/Inventory warmup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('[Warmup]', errorMsg);
      errors.push(errorMsg);
    }

    const totalDuration = performance.now() - startTime;

    return new Response(
      JSON.stringify({
        status: errors.length > 0 ? 'partial' : 'warm',
        timestamp: Date.now(),
        duration: `${totalDuration.toFixed(0)}ms`,
        caches: warmedCaches,
        errors: errors.length > 0 ? errors : undefined,
        message: errors.length > 0
          ? `Partially warmed ${warmedCaches.length} caches with ${errors.length} errors`
          : `Successfully warmed ${warmedCaches.length} caches`
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );

  } catch (error) {
    console.error('[Warmup] Critical error:', error);

    return new Response(
      JSON.stringify({
        status: 'error',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
        warmedCaches,
        message: 'Warmup failed with critical error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  }
};
