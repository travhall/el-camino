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
  // Shared timing constants — all used by FilterCoordinator for AppliedFilters coordination.
  // Grid card animation timing (duration, stagger) lives in ProductGrid.astro CSS custom properties.
  static readonly TIMING = {
    gridExit: 150,               // Grid card exit duration (ms) — matches CSS transition-duration override on .opacity-0
    appliedFiltersExit: 200,     // AppliedFilters fade-out duration (ms)
    appliedFiltersEntrance: 200, // AppliedFilters fade-in duration (ms)
    appliedFiltersDelay: 50,     // Delay before AppliedFilters fades in after page load (ms) — reduced to sync with grid card entrance
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
   * Coordinate exit animations before navigation.
   * Waits for the exit animation to complete before calling the navigation callback,
   * so the user sees a clean fade-out rather than an abrupt swap.
   * When removing the last filter, waits for the (longer) AppliedFilters exit instead.
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

    this.isAnimating = true;

    // Set filtering state for click prevention
    this.setFilteringState(true);

    // Check if we need to animate out AppliedFilters (product grid only).
    // Inspect actual filter params so non-filter query strings don't cause false positives.
    const willHaveNoFilters = targetUrl
      ? !FilterCoordinator.urlHasFilters(targetUrl)
      : false;
    const currentlyHasFilters =
      sessionStorage.getItem(this.STORAGE_KEYS.appliedFiltersShown) === "true";
    const needsAppliedFiltersExit = willHaveNoFilters && currentlyHasFilters;

    // Animate out AppliedFilters if needed (product grid only)
    if (needsAppliedFiltersExit && config === GRID_CONFIGS.product) {
      const container = document.getElementById("applied-filters-container");
      if (container) {
        container.style.transition = `opacity ${FilterCoordinator.TIMING.appliedFiltersExit}ms ease`;
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

        // Always wait for the exit animation to finish before navigating.
        // When AppliedFilters also needs to exit, use the longer of the two durations.
        const exitDelay =
          needsAppliedFiltersExit && config === GRID_CONFIGS.product
            ? FilterCoordinator.TIMING.appliedFiltersExit
            : FilterCoordinator.TIMING.gridExit;

        const timeoutId = setTimeout(() => {
          this.isAnimating = false; // Reset after animation completes, not in finally
          callback();
        }, exitDelay);
        this.timeoutIds.push(timeoutId);
        return;
      }
    }

    // No grid or no visible cards - navigate immediately
    this.isAnimating = false;
    callback();
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
    document.addEventListener("astro:before-swap", (e) => {
      // Backup: Only fade AppliedFilters when removing all filters (not on filter changes)
      const nextUrl = (e as any).to?.toString() ?? "";
      if (nextUrl && !FilterCoordinator.urlHasFilters(nextUrl)) {
        const container = document.getElementById("applied-filters-container");
        if (container && !container.classList.contains("no-filters")) {
          container.style.transition = "opacity 100ms ease";
          container.style.opacity = "0";
        }
      }

      FilterCoordinator.cleanupAnimationState();
    });

    // Early navigation preparation handler - runs before view transition preparation
    document.addEventListener("astro:before-preparation", (e) => {
      // Only fade AppliedFilters when removing all filters — not on filter changes
      const nextUrl = (e as any).to?.toString() ?? "";
      if (nextUrl && !FilterCoordinator.urlHasFilters(nextUrl)) {
        const container = document.getElementById("applied-filters-container");
        if (container && !container.classList.contains("no-filters")) {
          container.style.transition = `opacity ${FilterCoordinator.TIMING.appliedFiltersExit}ms ease`;
          container.style.opacity = "0";
        }
      }
    });

    // Page visibility handler - clear stale animation state after extended idle (5+ min).
    // Listeners are already registered; only state cleanup is needed, not re-initialization.
    let hiddenTime = 0;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        hiddenTime = Date.now();
      } else {
        const idleDuration = Date.now() - hiddenTime;
        if (hiddenTime > 0 && idleDuration > 300000) {
          // 5 minutes
          FilterCoordinator.cleanupAnimationState();
        }
      }
    });

    // Handle page show event (fired when navigating back via browser history)
    // Listeners are already registered; only state cleanup is needed. cSpell:ignore bfcache
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        // bfcache restore: clear any stale filtering/animation state
        FilterCoordinator.cleanupAnimationState();
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
        container.style.transition = `opacity ${FilterCoordinator.TIMING.appliedFiltersEntrance}ms ease, visibility 0s`;
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
      }, FilterCoordinator.TIMING.appliedFiltersDelay + FilterCoordinator.TIMING.appliedFiltersEntrance);
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

  /**
   * Check if a URL contains active filter parameters.
   * More robust than checking for "?" — handles non-filter query strings gracefully.
   */
  private static urlHasFilters(url: string): boolean {
    try {
      const u = new URL(url, location.href);
      return u.searchParams.has("brands") || u.searchParams.get("availability") === "true";
    } catch {
      return url.includes("?");
    }
  }
}
