// src/lib/square/navigationUtils.ts
import { fetchCategoryHierarchy } from "./categories";
import { categoryCache } from "./cacheUtils";
import { processSquareError, handleError, ErrorType } from "./errorUtils";
import type {
  NavigationItem,
  StaticNavigationItem,
  NavigationConfig,
  NavigationError,
} from "./types";

/**
 * Enhanced navigation data fetching with existing cache integration
 */
export async function fetchNavigationData(): Promise<NavigationConfig> {
  return categoryCache.getOrCompute("navigation-config", async () => {
    try {
      // Leverage existing fetchCategoryHierarchy with proven caching
      const categoryHierarchy = await fetchCategoryHierarchy();

      // Transform using existing data structures
      const navigationItems: NavigationItem[] = categoryHierarchy.map(
        (hierarchy) => ({
          category: hierarchy.category,
          subcategories: hierarchy.subcategories,
          hasProducts: hierarchy.subcategories.length > 0,
        })
      );

      // Static items from existing site configuration patterns
      const staticItems: StaticNavigationItem[] = [
        {
          id: "shop",
          name: "The Shop",
          slug: "shop",
          url: "/shop",
          subcategories: [],
        },
        {
          id: "news",
          name: "News",
          slug: "news",
          url: "/news",
          subcategories: [],
        },
      ];

      return {
        items: navigationItems,
        staticItems,
        mobileBreakpoint: 768,
        animationDuration: 300,
      };
    } catch (error) {
      const appError = processSquareError(error, "fetchNavigationData");
      const navigationError: NavigationError = {
        ...appError,
        fallbackUsed: true,
        staticItemsOnly: true,
      };

      return handleError<NavigationConfig>(navigationError, {
        items: [],
        staticItems: [
          {
            id: "shop",
            name: "The Shop",
            slug: "shop",
            url: "/shop",
            subcategories: [],
          },
          {
            id: "news",
            name: "News",
            slug: "news",
            url: "/news",
            subcategories: [],
          },
        ],
        mobileBreakpoint: 768,
        animationDuration: 300,
      });
    }
  });
}

/**
 * Generate navigation URLs using existing site patterns
 */
export function generateNavigationUrl(
  item: NavigationItem | StaticNavigationItem
): string {
  if ("category" in item) {
    return `/category/${item.category.slug}`;
  }
  return item.url;
}

/**
 * Generate subcategory URLs
 */
export function generateSubcategoryUrl(
  parentItem: NavigationItem | StaticNavigationItem,
  subcategory: any
): string {
  if ("category" in parentItem) {
    return `/category/${parentItem.category.slug}/${subcategory.slug}`;
  }
  return `${parentItem.url}/${subcategory.slug}`;
}

/**
 * Get combined navigation items in proper order
 */
export function getCombinedNavigationItems(
  config: NavigationConfig
): Array<NavigationItem | StaticNavigationItem> {
  return [
    config.staticItems[0], // "The Shop" first
    ...config.items, // Dynamic categories
    config.staticItems[1], // "News" last
  ];
}

/**
 * Performance monitoring class
 */
export class NavigationPerformanceMonitor {
  private static startTimes: Map<string, number> = new Map();

  static markStart(operation: string): void {
    this.startTimes.set(operation, performance.now());
  }

  static markEnd(operation: string): number {
    const startTime = this.startTimes.get(operation);
    if (!startTime) return 0;

    const duration = performance.now() - startTime;
    this.startTimes.delete(operation);

    // Log slow operations using existing error system
    if (duration > 100) {
      console.warn(
        `Slow navigation operation: ${operation} took ${duration.toFixed(2)}ms`
      );
    }

    return duration;
  }
}

/**
 * Clear navigation cache (extends existing cache clearing)
 */
export function clearNavigationCache(): void {
  categoryCache.delete("navigation-config");
}

/**
 * Validate navigation configuration
 */
export function validateNavigationConfig(config: NavigationConfig): boolean {
  if (!config.items || !Array.isArray(config.items)) return false;
  if (!config.staticItems || !Array.isArray(config.staticItems)) return false;
  if (typeof config.mobileBreakpoint !== "number") return false;
  if (typeof config.animationDuration !== "number") return false;

  return true;
}

/**
 * Get navigation item accessibility info
 */
export function getNavigationAccessibility(
  item: NavigationItem | StaticNavigationItem
) {
  const hasSubmenu = item.subcategories.length > 0;
  const itemName = "category" in item ? item.category.name : item.name;

  return {
    hasSubmenu,
    isExpanded: false, // Default state
    ariaLabel: hasSubmenu ? `${itemName} submenu` : itemName,
    keyboardSupport: true,
  };
}
