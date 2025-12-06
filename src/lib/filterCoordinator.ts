// src/lib/filterCoordinator.ts
// Unified animation and state coordination for filter components

// Grid configuration for different grid types
export interface GridConfig {
  gridId: string;
  cardSelector: string;
  readyEventName: string;
}

export const GRID_CONFIGS = {
  product: {
    gridId: "filterable-product-grid",
    cardSelector: ".product-card-wrapper",
    readyEventName: "productGridReady",
  } as GridConfig,
  article: {
    gridId: "filterable-article-grid",
    cardSelector: ".article-card-wrapper",
    readyEventName: "articleGridReady",
  } as GridConfig,
} as const;

export class FilterCoordinator {
  // Shared timing constants across all components
  // Note: exit, entrance, stagger, and rowStagger are used by grids (ProductGrid.astro, ArticleGrid.astro)
  // appliedFiltersDelay is used by FilterCoordinator for AppliedFilters animation
  static readonly TIMING = {
    exit: 200, // Duration for exit animations (ms)
    entrance: 200, // Duration for entrance animations (ms)
    stagger: 75, // Delay between card animations (ms)
    rowStagger: 150, // Delay between rows (ms)
    appliedFiltersDelay: 300, // AppliedFilters appearance delay
  };

  // Shared state management
  private static isInitialized = false;
  private static isAnimating = false;
  private static currentInstance: FilterCoordinator | null = null;
  private static timeoutIds: ReturnType<typeof setTimeout>[] = [];

  // Session storage keys - consistent kebab-case naming
  private static readonly STORAGE_KEYS = {
    filteringInProgress: "filtering-in-progress",
    appliedFiltersShown: "applied-filters-shown",
    filterMenuExpanded: "filter-menu-expanded",
  };

  static getInstance(): FilterCoordinator {
    if (!this.currentInstance) {
      this.currentInstance = new FilterCoordinator();
    }
    return this.currentInstance;
  }

  /**
   * Initialize the unified filter system
   * Called once per page load - prevents duplicate initialization
   */
  static initialize(): void {
    if (this.isInitialized) {
      return;
    }

    this.getInstance().setupEventListeners();
    this.isInitialized = true;

    // Clean up any stale animation state
    this.cleanupAnimationState();
  }

  /**
   * Coordinate exit animations before navigation
   * Exit animation visible with instant navigation for best UX
   * If removing last filter, AppliedFilters must animate out BEFORE navigation
   *
   * @param callback - Function to call after exit animations complete
   * @param targetUrl - Optional target URL to determine if filters are being cleared
   * @param config - Grid configuration (defaults to product grid)
   */
  static coordinateExit(
    callback: () => void,
    targetUrl?: string,
    config: GridConfig = GRID_CONFIGS.product
  ): void {
    // Prevent multiple simultaneous calls
    if (this.isAnimating) {
      callback();
      return;
    }

    try {
      this.isAnimating = true;

      // Set filtering state for click prevention
      this.setFilteringState(true);

      // Check if we need to animate out AppliedFilters (product grid only)
      // If targetUrl has no query params, we're removing the last filter
      const willHaveNoFilters = targetUrl ? !targetUrl.includes("?") : false;
      const currentlyHasFilters =
        sessionStorage.getItem(this.STORAGE_KEYS.appliedFiltersShown) ===
        "true";
      const needsAppliedFiltersExit = willHaveNoFilters && currentlyHasFilters;

      // Animate out AppliedFilters if needed (product grid only)
      if (needsAppliedFiltersExit && config === GRID_CONFIGS.product) {
        const container = document.getElementById("applied-filters-container");
        if (container) {
          container.style.transition = "opacity 200ms ease";
          container.style.opacity = "0";
        }
      }

      // Apply exit animations to grid
      const grid = document.getElementById(config.gridId) as HTMLElement;
      if (grid) {
        // Target all visible cards (not just opacity-100 ones)
        const visibleCards = grid.querySelectorAll(
          config.cardSelector
        ) as NodeListOf<HTMLElement>;

        if (visibleCards.length > 0) {
          // Apply exit animation to all visible cards
          visibleCards.forEach((card) => {
            // Force immediate exit animation by overriding CSS delays
            card.style.setProperty("--card-stagger-delay", "0ms");
            card.style.setProperty("--animation-order", "0");
            card.style.setProperty("transition-delay", "0s, 0s");

            card.classList.remove("opacity-100");
            card.classList.add("opacity-0");
          });

          // If AppliedFilters needs to exit, wait for it to complete before navigating
          // Otherwise navigate immediately while grid animations play
          if (needsAppliedFiltersExit && config === GRID_CONFIGS.product) {
            const timeoutId = setTimeout(() => {
              callback();
            }, 200);
            this.timeoutIds.push(timeoutId);
          } else {
            callback();
          }
          return;
        }
      }

      // No grid or no visible cards - navigate immediately
      callback();
    } finally {
      // Ensure isAnimating gets reset even if errors occur
      this.isAnimating = false;
    }
  }

  /**
   * Coordinate entrance animations after page load
   * Ensures all components animate in sync
   *
   * @param config - Optional grid configuration (auto-detects if not provided)
   */
  static coordinateEntrance(config?: GridConfig): void {
    const instance = this.getInstance();

    // Auto-detect which grid is present if not specified
    if (!config) {
      const hasProductGrid = !!document.getElementById(
        GRID_CONFIGS.product.gridId
      );
      const hasArticleGrid = !!document.getElementById(
        GRID_CONFIGS.article.gridId
      );

      if (hasProductGrid) {
        config = GRID_CONFIGS.product;
      } else if (hasArticleGrid) {
        config = GRID_CONFIGS.article;
      } else {
        return; // No grid found
      }
    }

    // Apply entrance timing to AppliedFilters (product grid only)
    if (config === GRID_CONFIGS.product) {
      instance.coordinateAppliedFiltersEntrance();
    }

    // Apply entrance timing to grid
    instance.coordinateGridEntrance(config);
  }

  /**
   * Clean up animation state and session storage
   * Note: Does NOT clear appliedFiltersShown - that tracks state across page transitions
   */
  static cleanupAnimationState(): void {
    sessionStorage.removeItem(this.STORAGE_KEYS.filteringInProgress);
    document.body.classList.remove("filtering-in-progress");
    this.isAnimating = false;

    // Clear all pending timeouts
    this.timeoutIds.forEach((id) => clearTimeout(id));
    this.timeoutIds = [];
  }

  /**
   * Reset initialization state for page navigation
   * Allows re-initialization on new page loads
   * Note: Preserves appliedFiltersShown state for proper transition detection
   */
  static reset(): void {
    this.cleanupAnimationState();
    this.isInitialized = false;
    this.currentInstance = null;
    // appliedFiltersShown is intentionally NOT cleared here
    // It's managed by coordinateAppliedFiltersEntrance based on URL state
  }

  /**
   * Set filtering state during navigation
   */
  static setFilteringState(isActive: boolean): void {
    if (isActive) {
      sessionStorage.setItem(this.STORAGE_KEYS.filteringInProgress, "true");
      document.body.classList.add("filtering-in-progress");
    } else {
      // Only clear the filtering state, NOT the animation timeouts
      // The timeouts are for AppliedFilters entrance animations which need to complete
      sessionStorage.removeItem(this.STORAGE_KEYS.filteringInProgress);
      document.body.classList.remove("filtering-in-progress");
      this.isAnimating = false;
    }
  }

  private constructor() {}

  private setupEventListeners(): void {
    // Unified page load handler - coordinates entrance animations and clears filtering state
    document.addEventListener("astro:page-load", () => {
      FilterCoordinator.coordinateEntrance();
      FilterCoordinator.setFilteringState(false);
    });

    // Unified cleanup handler - runs before page swap
    document.addEventListener("astro:before-swap", () => {
      // Backup: Ensure AppliedFilters is hidden (in case before-preparation didn't work)
      const container = document.getElementById("applied-filters-container");
      if (container && !container.classList.contains("no-filters")) {
        container.style.transition = "opacity 100ms ease";
        container.style.opacity = "0";
      }

      FilterCoordinator.cleanupAnimationState();
    });

    // Early navigation preparation handler - runs before view transition preparation
    document.addEventListener("astro:before-preparation", () => {
      // Animate out AppliedFilters if visible when leaving page
      const container = document.getElementById("applied-filters-container");
      if (container && !container.classList.contains("no-filters")) {
        container.style.transition = "opacity 200ms ease";
        container.style.opacity = "0";
      }
    });

    // Page visibility handler - reset animation state when page becomes visible after being hidden
    // Only runs after extended idle periods (5+ minutes)
    let hiddenTime = 0;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // Track when page was hidden
        hiddenTime = Date.now();
      } else {
        // Page is visible again - only reset if hidden for more than 5 minutes
        const idleDuration = Date.now() - hiddenTime;
        if (hiddenTime > 0 && idleDuration > 300000) {
          // 5 minutes
          FilterCoordinator.cleanupAnimationState();
          FilterCoordinator.isInitialized = false;
          FilterCoordinator.initialize();
        }
      }
    });

    // Handle page show event (fired when navigating back via browser history)
    window.addEventListener("pageshow", (event) => {
      // If page is loaded from bfcache (back/forward cache), reset state
      if (event.persisted) {
        FilterCoordinator.cleanupAnimationState();
        FilterCoordinator.isInitialized = false;
        FilterCoordinator.initialize();
      }
    });
  }

  private coordinateGridEntrance(config: GridConfig): void {
    const grid = document.getElementById(config.gridId);
    if (!grid) return;

    // Ensure grid is visible for animations
    grid.style.visibility = "visible";
    grid.style.opacity = "1";

    // Trigger grid's entrance animation system
    const event = new CustomEvent(config.readyEventName, {
      detail: {
        cardCount: grid.querySelectorAll(config.cardSelector).length,
      },
    });
    window.dispatchEvent(event);
  }

  private coordinateAppliedFiltersEntrance(): void {
    const container = document.getElementById("applied-filters-container");
    if (!container) return;

    // Check if we have active filters NOW
    const urlParams = new URLSearchParams(window.location.search);
    const currentBrands = urlParams.getAll("brands") || [];
    const currentAvailability = urlParams.get("availability") === "true";
    const hasFilters = currentBrands.length > 0 || currentAvailability;

    // Check what the filter state was BEFORE this navigation
    const previousFilterState = sessionStorage.getItem(
      FilterCoordinator.STORAGE_KEYS.appliedFiltersShown
    );
    const hadFiltersBefore = previousFilterState === "true";
    const hadNoFiltersBefore = previousFilterState === "false";

    if (!hasFilters) {
      // No filters - just hide (exit animation already handled in coordinateExit)
      container.classList.add("no-filters");
      container.style.transition = "";
      container.style.visibility = "";
      container.style.opacity = "";

      sessionStorage.setItem(
        FilterCoordinator.STORAGE_KEYS.appliedFiltersShown,
        "false"
      );
      return;
    }

    // We have filters now
    container.classList.remove("no-filters");

    // Only animate if transitioning FROM no filters TO has filters
    if (!hadFiltersBefore || hadNoFiltersBefore) {
      // First time showing filters (or returning from no filters state) - animate
      container.style.visibility = "hidden";
      container.style.opacity = "0";

      // Delay before starting fade-in animation
      const timeoutId1 = setTimeout(() => {
        container.style.transition = "opacity 200ms ease, visibility 0s";
        container.style.visibility = "visible";
        container.style.opacity = "1";

        sessionStorage.setItem(
          FilterCoordinator.STORAGE_KEYS.appliedFiltersShown,
          "true"
        );
      }, FilterCoordinator.TIMING.appliedFiltersDelay);
      FilterCoordinator.timeoutIds.push(timeoutId1);

      // Clean up transition after animation completes
      const timeoutId2 = setTimeout(() => {
        container.style.transition = "";
      }, FilterCoordinator.TIMING.appliedFiltersDelay + 200);
      FilterCoordinator.timeoutIds.push(timeoutId2);
    } else {
      // Already had filters - just update content instantly
      container.style.transition = "none";
      container.style.visibility = "visible";
      container.style.opacity = "1";

      void container.offsetHeight;

      requestAnimationFrame(() => {
        container.style.transition = "";
      });

      sessionStorage.setItem(
        FilterCoordinator.STORAGE_KEYS.appliedFiltersShown,
        "true"
      );
    }
  }

  /**
   * Get shared session storage keys
   */
  static getStorageKeys() {
    return this.STORAGE_KEYS;
  }

  /**
   * Get shared timing constants
   */
  static getTiming() {
    return this.TIMING;
  }
}
