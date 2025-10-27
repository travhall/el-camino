// src/lib/square/navigationUtils.ts - Navigation-specific caching utilities

import { categoryCache } from "./cacheUtils";
import { fetchCategoryHierarchy } from "./categories";
import type { CategoryHierarchy } from "./types";
import { processSquareError, handleError } from "./errorUtils";

/**
 * Enhanced category hierarchy fetch specifically optimized for navigation
 * Uses existing cache TTL and improved error handling for navigation stability
 */
export async function fetchCategoryHierarchyForNav(): Promise<
  CategoryHierarchy[]
> {
  return categoryCache.getOrCompute("nav-hierarchy", async () => {
    try {
      const hierarchy = await fetchCategoryHierarchy();

      // Filter out categories with empty names or invalid data
      const validHierarchy = hierarchy.filter(
        (item) =>
          item.category.name &&
          item.category.name.trim() !== "" &&
          item.category.slug &&
          item.category.slug.trim() !== ""
      );

      // console.log(
      //   `[Navigation] Cached ${validHierarchy.length} valid categories for navigation`
      // );
      return validHierarchy;
    } catch (error) {
      console.warn(
        "Navigation category fetch failed, using graceful fallback:",
        error
      );
      // Never break navigation - return empty array for graceful degradation
      return [];
    }
  });
}

/**
 * Get navigation context for prefetch strategy determination
 */
export interface NavigationContext {
  currentPath: string;
  isProductCategory: boolean;
  isMobile: boolean;
  isHomepage: boolean;
  categoryDepth: number;
}

/**
 * Determine prefetch strategy based on navigation context and category importance
 */
export function getPrefetchStrategy(
  categoryName: string,
  context: NavigationContext
): string {
  // High-priority navigation items get viewport prefetching
  const highPriorityPages = [
    "The Shop",
    "News",
    "Decks",
    "Apparel",
    "Skateboards",
  ];

  if (highPriorityPages.includes(categoryName)) {
    return "viewport"; // Prefetch when visible
  }

  // Product category pages get hover prefetching for better conversion
  if (context.isProductCategory) {
    return "hover"; // Prefetch on mouse hover
  }

  // Mobile users get tap prefetching to conserve bandwidth
  if (context.isMobile) {
    return "tap"; // Prefetch on touch start
  }

  // Homepage gets more aggressive prefetching
  if (context.isHomepage) {
    return "viewport"; // Load key pages when visible
  }

  return "hover"; // Default strategy for balanced performance
}

/**
 * Enhanced navigation metrics tracking
 */
export interface NavigationMetrics {
  navigationStartTime: number;
  prefetchStrategy: string;
  categoryName: string;
  fromPath: string;
  toPath: string;
}

/**
 * Track navigation performance for optimization insights
 */
export function trackNavigationPerformance(metrics: NavigationMetrics): void {
  if (typeof performance !== "undefined") {
    const navigationDuration = performance.now() - metrics.navigationStartTime;

    // Log performance insights in development
    if (import.meta.env.DEV) {
      console.log(`[Navigation Performance] ${metrics.categoryName}:`, {
        duration: `${navigationDuration.toFixed(2)}ms`,
        strategy: metrics.prefetchStrategy,
        path: `${metrics.fromPath} → ${metrics.toPath}`,
      });
    }

    // Track slow navigation
    if (navigationDuration > 500) {
      console.warn("[Navigation] Slow navigation detected:", {
        duration: navigationDuration,
        category: metrics.categoryName,
        strategy: metrics.prefetchStrategy,
      });
    }
  }
}

/**
 * Get navigation context from current page state
 */
export function getNavigationContext(): NavigationContext {
  if (typeof window === "undefined") {
    return {
      currentPath: "/",
      isProductCategory: false,
      isMobile: false,
      isHomepage: true,
      categoryDepth: 0,
    };
  }

  const path = window.location.pathname;
  const isMobile = window.innerWidth <= 1024;

  return {
    currentPath: path,
    isProductCategory:
      path.includes("/category/") || path.includes("/product/"),
    isMobile: isMobile,
    isHomepage: path === "/",
    categoryDepth: (path.match(/\//g) || []).length - 1,
  };
}

/**
 * Prefetch high-priority navigation targets based on current context
 */
export function prefetchHighPriorityTargets(context: NavigationContext): void {
  const highPriorityUrls: string[] = [];

  if (context.isHomepage) {
    // From homepage, users likely visit the-shop or news (match actual URLs)
    highPriorityUrls.push("/the-shop", "/news");
  } else if (context.currentPath.startsWith("/category/")) {
    // From category pages, prefetch main shop page and news
    // Using safer URLs that definitely exist
    highPriorityUrls.push("/the-shop", "/news");
  }

  // Use modern link prefetch for high-priority targets
  highPriorityUrls.forEach((url) => {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = url;
    document.head.appendChild(link);
  });

  // Log prefetch attempts in development
  if (import.meta.env.DEV && highPriorityUrls.length > 0) {
    // console.log(
    //   "[Navigation] Prefetching high-priority targets:",
    //   highPriorityUrls
    // );
  }
}

/**
 * Initialize navigation performance tracking
 */
export function initNavigationTracking(): void {
  if (typeof window === "undefined") return;

  let navigationStart = performance.now();

  // Track page navigation timing
  document.addEventListener("astro:before-swap", () => {
    navigationStart = performance.now();
  });

  document.addEventListener("astro:after-swap", () => {
    const context = getNavigationContext();
    trackNavigationPerformance({
      navigationStartTime: navigationStart,
      prefetchStrategy: getPrefetchStrategy("Unknown", context),
      categoryName: "Page Navigation",
      fromPath: document.referrer || "direct",
      toPath: context.currentPath,
    });
  });
}
