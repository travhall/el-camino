// src/lib/filterCoordinator.ts
// Unified animation and state coordination for filter components

export class FilterCoordinator {
  // Shared timing constants across all components
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
      console.warn(
        "[FilterCoordinator] Already initialized, skipping duplicate initialization"
      );
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
   */
  static coordinateExit(callback: () => void): void {
    // Prevent multiple simultaneous calls
    if (this.isAnimating) {
      callback();
      return;
    }
    this.isAnimating = true;

    // Set filtering state for click prevention
    this.setFilteringState(true);

    // Apply exit animations to product grid
    const grid = document.getElementById(
      "filterable-product-grid"
    ) as HTMLElement;
    if (grid) {
      // Target all visible cards (not just opacity-100 ones)
      const visibleCards = grid.querySelectorAll(
        ".product-card-wrapper"
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

        // FIXED: Call the navigation callback after applying animations
        // Navigation happens immediately while animations play
        callback();
        return;
      }
    }

    // No grid or no visible cards - navigate immediately
    callback();
    this.isAnimating = false;
  }

  /**
   * Coordinate entrance animations after page load
   * Ensures all components animate in sync
   */
  static coordinateEntrance(): void {
    const instance = this.getInstance();

    // Apply entrance timing to ProductGrid
    instance.coordinateProductGridEntrance();

    // Apply entrance timing to AppliedFilters
    instance.coordinateAppliedFiltersEntrance();
  }

  /**
   * Clean up animation state and session storage
   */
  static cleanupAnimationState(): void {
    sessionStorage.removeItem(this.STORAGE_KEYS.filteringInProgress);
    sessionStorage.removeItem(this.STORAGE_KEYS.appliedFiltersShown);
    document.body.classList.remove("filtering-in-progress");
    this.isAnimating = false;
  }

  /**
   * Reset initialization state for page navigation
   * Allows re-initialization on new page loads
   */
  static reset(): void {
    this.cleanupAnimationState();
    this.isInitialized = false;
    this.currentInstance = null;
  }

  /**
   * Set filtering state during navigation
   */
  static setFilteringState(isActive: boolean): void {
    if (isActive) {
      sessionStorage.setItem(this.STORAGE_KEYS.filteringInProgress, "true");
      document.body.classList.add("filtering-in-progress");
    } else {
      this.cleanupAnimationState();
    }
  }

  /**
   * Check if filtering is currently in progress
   */
  static isFilteringInProgress(): boolean {
    return (
      sessionStorage.getItem(this.STORAGE_KEYS.filteringInProgress) === "true"
    );
  }

  private constructor() {}

  private setupEventListeners(): void {
    // Unified page load handler
    document.addEventListener("astro:page-load", () => {
      FilterCoordinator.coordinateEntrance();
    });

    // Unified cleanup handler
    document.addEventListener("astro:before-swap", () => {
      FilterCoordinator.cleanupAnimationState();
    });

    // Unified page load complete handler
    document.addEventListener("astro:page-load", () => {
      FilterCoordinator.setFilteringState(false);
    });
  }

  private coordinateProductGridEntrance(): void {
    const grid = document.getElementById("filterable-product-grid");
    if (!grid) return;

    // Ensure grid is visible for animations
    grid.style.visibility = "visible";
    grid.style.opacity = "1";

    // Trigger ProductGrid's existing entrance animation system
    const event = new CustomEvent("productGridReady", {
      detail: {
        productCount: grid.querySelectorAll(".product-card-wrapper").length,
      },
    });
    window.dispatchEvent(event);
  }

  private coordinateAppliedFiltersEntrance(): void {
    const container = document.getElementById("applied-filters-container");
    if (!container) return;

    // Check if we have active filters
    const urlParams = new URLSearchParams(window.location.search);
    const currentBrands = urlParams.getAll("brands") || [];
    const currentAvailability = urlParams.get("availability") === "true";
    const hasFilters = currentBrands.length > 0 || currentAvailability;

    if (!hasFilters) {
      container.classList.add("no-filters");
      return;
    }

    container.classList.remove("no-filters");

    // Check if we should apply timing logic
    const hasShownBefore =
      sessionStorage.getItem(
        FilterCoordinator.STORAGE_KEYS.appliedFiltersShown
      ) === "true";

    if (hasFilters && !hasShownBefore) {
      // First time showing - apply coordinated timing
      container.style.visibility = "hidden";
      container.style.opacity = "0";

      setTimeout(() => {
        container.style.visibility = "visible";
        container.style.opacity = "1";
        container.style.transition = "opacity 200ms ease";
        sessionStorage.setItem(
          FilterCoordinator.STORAGE_KEYS.appliedFiltersShown,
          "true"
        );
      }, FilterCoordinator.TIMING.appliedFiltersDelay);
    } else if (hasFilters) {
      // Already shown before - appear immediately
      container.style.visibility = "visible";
      container.style.opacity = "1";
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
