// src/lib/square/navigationClient.ts
// Client-safe navigation utilities — no server-side Square imports.
// Imported by Nav.astro <script> tag (client bundle).

export interface NavigationContext {
  currentPath: string;
  isProductCategory: boolean;
  isMobile: boolean;
  isHomepage: boolean;
  categoryDepth: number;
}

export interface NavigationMetrics {
  navigationStartTime: number;
  prefetchStrategy: string;
  categoryName: string;
  fromPath: string;
  toPath: string;
}

/**
 * Determine prefetch strategy based on navigation context and category importance
 */
export function getPrefetchStrategy(
  categoryName: string,
  context: NavigationContext
): string {
  const highPriorityPages = [
    "The Shop",
    "News",
    "Decks",
    "Apparel",
    "Skateboards",
  ];

  if (highPriorityPages.includes(categoryName)) return "viewport";
  if (context.isProductCategory) return "hover";
  if (context.isMobile) return "tap";
  if (context.isHomepage) return "viewport";
  return "hover";
}

/**
 * Track navigation performance for optimization insights
 */
export function trackNavigationPerformance(metrics: NavigationMetrics): void {
  if (typeof performance !== "undefined") {
    const navigationDuration = performance.now() - metrics.navigationStartTime;

    if (import.meta.env.DEV) {
      console.log(`[Navigation Performance] ${metrics.categoryName}:`, {
        duration: `${navigationDuration.toFixed(2)}ms`,
        strategy: metrics.prefetchStrategy,
        path: `${metrics.fromPath} → ${metrics.toPath}`,
      });
    }

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
    isMobile,
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
    highPriorityUrls.push("/the-shop", "/news");
  } else if (context.currentPath.startsWith("/category/")) {
    highPriorityUrls.push("/the-shop", "/news");
  }

  highPriorityUrls.forEach((url) => {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = url;
    document.head.appendChild(link);
  });
}
