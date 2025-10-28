// src/lib/constants/pagination.ts
// Performance-optimized pagination configuration

/**
 * Initial page size for product listings
 * Optimized for mobile network performance and Time to Interactive (TTI)
 * 
 * Why 24 products?
 * - Desktop: 3-4 columns × 6-8 rows = ~24 visible products
 * - Mobile: 2 columns × 12 rows = ~24 visible products
 * - Network: ~48KB JSON + ~1.2MB images (reasonable initial load)
 * - Performance: Keeps TTI < 3.5s on mobile 4G
 */
export const INITIAL_PAGE_SIZE = 24;

/**
 * Products to load per "Load More" action
 * Smaller batch for progressive loading
 */
export const LOAD_MORE_SIZE = 12;

/**
 * Maximum products to fetch from Square API at once
 * Safety limit to prevent memory issues
 */
export const MAX_API_FETCH_SIZE = 200;

/**
 * Threshold for enabling infinite scroll vs "Load More" button
 * Below this number, show all products immediately
 * Above this number, enable progressive loading
 */
export const INFINITE_SCROLL_THRESHOLD = 30;
