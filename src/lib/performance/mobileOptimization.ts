// src/lib/performance/mobileOptimization.ts - Mobile-specific navigation optimizations

interface MobileContext {
  isMobile: boolean;
  isSlowConnection: boolean;
  touchDevice: boolean;
  screenWidth: number;
  connectionType: string;
}

interface MobilePrefetchConfig {
  strategy: "tap" | "hover" | "viewport" | "conservative";
  maxConcurrent: number;
  respectDataSaver: boolean;
  eagerness: "conservative" | "moderate" | "eager";
}

export class MobileNavigationOptimizer {
  private context: MobileContext;
  private prefetchConfig: MobilePrefetchConfig;
  private prefetchQueue: string[] = [];
  private activePrefetches = 0;

  constructor() {
    this.context = this.detectMobileContext();
    this.prefetchConfig = this.getMobilePrefetchConfig();
    this.init();
  }

  private detectMobileContext(): MobileContext {
    const isMobile = window.innerWidth <= 1024;
    const touchDevice = "ontouchstart" in window;

    // Detect slow connections
    const connection = (navigator as any).connection;
    const isSlowConnection = connection
      ? connection.effectiveType === "slow-2g" ||
        connection.effectiveType === "2g" ||
        connection.saveData
      : false;

    return {
      isMobile,
      isSlowConnection,
      touchDevice,
      screenWidth: window.innerWidth,
      connectionType: connection?.effectiveType || "unknown",
    };
  }

  private getMobilePrefetchConfig(): MobilePrefetchConfig {
    const { isMobile, isSlowConnection, touchDevice } = this.context;

    if (isSlowConnection) {
      return {
        strategy: "conservative",
        maxConcurrent: 1,
        respectDataSaver: true,
        eagerness: "conservative",
      };
    }

    if (isMobile && touchDevice) {
      return {
        strategy: "tap",
        maxConcurrent: 2,
        respectDataSaver: true,
        eagerness: "moderate",
      };
    }

    return {
      strategy: "hover",
      maxConcurrent: 3,
      respectDataSaver: false,
      eagerness: "moderate",
    };
  }

  private init(): void {
    this.optimizeForMobile();
    this.setupTouchOptimizations();
    this.setupConnectionAwareness();

    if (import.meta.env.DEV) {
      console.log("[Mobile] Optimization initialized:", {
        context: this.context,
        config: this.prefetchConfig,
      });
    }
  }

  private optimizeForMobile(): void {
    // Priority resource loading for mobile
    this.prioritizeCriticalResources();

    // Optimize touch interactions
    this.optimizeTouchTargets();

    // Reduce motion for performance
    this.optimizeAnimations();
  }

  private prioritizeCriticalResources(): void {
    // Prioritize above-the-fold content
    const criticalLinks = document.querySelectorAll(
      '.nav-item[data-category-name="The Shop"], .nav-item[data-category-name="News"]'
    );

    criticalLinks.forEach((link) => {
      const anchor = link as HTMLAnchorElement;
      anchor.setAttribute("data-astro-prefetch", "viewport");
    });
  }

  private optimizeTouchTargets(): void {
    // Increase touch targets for mobile
    const navItems = document.querySelectorAll(".nav-item");

    navItems.forEach((item) => {
      const element = item as HTMLElement;
      if (this.context.isMobile) {
        element.style.minHeight = "44px"; // iOS minimum touch target
        element.style.padding = "12px 16px";
      }
    });
  }

  private optimizeAnimations(): void {
    // Reduce motion for performance on mobile
    if (this.context.isMobile) {
      const style = document.createElement("style");
      style.textContent = `
        @media (max-width: 1024px) {
          .nav-item, .dropdown-menu {
            transition-duration: 0.2s !important;
          }
          
          .nav-link {
            animation-duration: 0.3s !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  private setupTouchOptimizations(): void {
    // Touch-specific prefetch behavior
    document.addEventListener(
      "touchstart",
      (e) => {
        const target = e.target as HTMLElement;
        const link = target.closest(".nav-item") as HTMLAnchorElement;

        if (link && this.shouldPrefetch(link.href)) {
          this.queuePrefetch(link.href);
        }
      },
      { passive: true }
    );

    // Prevent accidental hover states on touch devices
    if (this.context.touchDevice) {
      document.addEventListener("touchend", () => {
        document.body.classList.add("touch-active");
        setTimeout(() => {
          document.body.classList.remove("touch-active");
        }, 500);
      });
    }
  }

  private setupConnectionAwareness(): void {
    // Monitor connection changes
    if ("connection" in navigator) {
      const connection = (navigator as any).connection;

      connection.addEventListener("change", () => {
        this.context = this.detectMobileContext();
        this.prefetchConfig = this.getMobilePrefetchConfig();

        if (import.meta.env.DEV) {
          console.log("[Mobile] Connection changed:", {
            type: connection.effectiveType,
            saveData: connection.saveData,
          });
        }
      });
    }
  }

  private shouldPrefetch(url: string): boolean {
    // Don't prefetch if data saver is on
    if (this.prefetchConfig.respectDataSaver) {
      const connection = (navigator as any).connection;
      if (connection?.saveData) return false;
    }

    // Don't prefetch if too many active
    if (this.activePrefetches >= this.prefetchConfig.maxConcurrent) {
      return false;
    }

    // Don't prefetch external links
    if (!url.startsWith(window.location.origin)) {
      return false;
    }

    return true;
  }

  private queuePrefetch(url: string): void {
    if (this.prefetchQueue.includes(url)) return;

    this.prefetchQueue.push(url);
    this.processPrefetchQueue();
  }

  private processPrefetchQueue(): void {
    if (this.prefetchQueue.length === 0) return;
    if (this.activePrefetches >= this.prefetchConfig.maxConcurrent) return;

    const url = this.prefetchQueue.shift();
    if (!url) return;

    this.activePrefetches++;

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = url;
    link.onload = () => {
      this.activePrefetches--;
      this.processPrefetchQueue();
    };
    link.onerror = () => {
      this.activePrefetches--;
      this.processPrefetchQueue();
    };

    document.head.appendChild(link);

    if (import.meta.env.DEV) {
      console.log("[Mobile] Prefetching:", url);
    }
  }

  // Public API for manual optimization
  public optimizeCurrentPage(): void {
    // Optimize current page based on mobile context
    if (this.context.isMobile) {
      this.addMobileStyles();
      this.optimizeViewport();
    }
  }

  private addMobileStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      @media (max-width: 1024px) {
        /* Better touch targets */
        .nav-item {
          min-height: 44px;
          padding: 12px 16px;
        }
        
        /* Reduce motion for performance */
        .touch-active * {
          transition-duration: 0.1s !important;
        }
        
        /* Improve readability */
        .nav-item {
          font-size: 18px;
          line-height: 1.4;
        }
        
        /* Optimize for thumb navigation */
        .category-group {
          margin-bottom: 8px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  private optimizeViewport(): void {
    // Ensure proper viewport configuration
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement("meta");
      viewport.setAttribute("name", "viewport");
      document.head.appendChild(viewport);
    }

    viewport.setAttribute(
      "content",
      "width=device-width, initial-scale=1, viewport-fit=cover"
    );
  }

  // Performance monitoring integration
  public getPerformanceMetrics(): any {
    return {
      mobileContext: this.context,
      prefetchConfig: this.prefetchConfig,
      queueLength: this.prefetchQueue.length,
      activePrefetches: this.activePrefetches,
    };
  }
}

// Global instance
let mobileOptimizer: MobileNavigationOptimizer | null = null;

// Initialize on DOM ready
export function initMobileOptimization(): void {
  if (typeof window === "undefined") return;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      mobileOptimizer = new MobileNavigationOptimizer();
    });
  } else {
    mobileOptimizer = new MobileNavigationOptimizer();
  }
}

// Export for manual optimization
export function optimizeMobileNavigation(): void {
  if (mobileOptimizer) {
    mobileOptimizer.optimizeCurrentPage();
  }
}

// Get current mobile performance metrics
export function getMobileMetrics(): any {
  return mobileOptimizer?.getPerformanceMetrics() || null;
}
