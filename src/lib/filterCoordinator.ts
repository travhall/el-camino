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
   * Note: Does NOT clear appliedFiltersShown - that tracks state across page transitions
   */
  static cleanupAnimationState(): void {
    sessionStorage.removeItem(this.STORAGE_KEYS.filteringInProgress);
    document.body.classList.remove("filtering-in-progress");
    this.isAnimating = false;
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

    console.log("[AppliedFilters] State check:", {
      hasFilters,
      hadFiltersBefore,
      previousFilterState,
      currentBrands,
      currentAvailability,
      shouldAnimate: !hadFiltersBefore && hasFilters,
    });

    if (!hasFilters) {
      // Going FROM filters TO no filters - just hide, no animation
      console.log("[AppliedFilters] Hiding (no filters)");
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
      console.log("[AppliedFilters] Animating fade in");
      container.style.visibility = "hidden";
      container.style.opacity = "0";

      setTimeout(() => {
        container.style.transition = "opacity 200ms ease, visibility 0s";
        container.style.visibility = "visible";
        container.style.opacity = "1";

        sessionStorage.setItem(
          FilterCoordinator.STORAGE_KEYS.appliedFiltersShown,
          "true"
        );

        setTimeout(() => {
          container.style.transition = "";
        }, 200);
      }, FilterCoordinator.TIMING.appliedFiltersDelay);
    } else {
      // Already had filters - just update content instantly
      console.log("[AppliedFilters] Instant update (already had filters)");
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
