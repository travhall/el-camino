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
