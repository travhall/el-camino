import {
  getNavigationContext,
  prefetchHighPriorityTargets,
} from '@/lib/square/navigationClient';

interface NavElementData {
  link: HTMLElement;
  expandBtn: HTMLElement | null;
  dropdown: HTMLElement;
  index: number;
  isOpen: boolean;
  prefetchStrategy: string;
  categoryName: string;
}

class OptimizedNavigationController {
  private navElements: Map<Element, NavElementData> = new Map();
  private isAnimating: boolean = false;
  private focusTimeout: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private abortController: AbortController = new AbortController();
  private overlay: HTMLElement | null = null;
  private overlayObserver: MutationObserver | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    this.cacheElements();
    this.setupEventDelegation();
    this.setupResizeObserver();
    this.setupOverlay();
    this.initializePrefetching();
    this.enhanceAccessibility();
    this.updateActiveStates();
  }

  private updateActiveStates(): void {
    // Get active category from body data attribute (set by server on product pages)
    const activeCategory =
      document.body.getAttribute('data-active-category') || '';
    const currentPath = window.location.pathname;
    const isProductPage = currentPath.includes('/product/');

    if (isProductPage && activeCategory) {
      // Find and activate the matching category nav item
      const navLinks = document.querySelectorAll('.nav-link');
      navLinks.forEach((link) => {
        const href = link.getAttribute('href') || '';
        const categorySlugMatch = href.match(/^\/category\/([^\/]+)$/);
        if (categorySlugMatch && categorySlugMatch[1] === activeCategory) {
          link.classList.add('lg:before:scale-x-100', 'lg:before:origin-left');
        }
      });
    }
  }

  private initializePrefetching(): void {
    const context = getNavigationContext();
    prefetchHighPriorityTargets(context);
  }

  private enhanceAccessibility(): void {
    const nav = document.querySelector('nav');
    if (!nav) return;

    // Enhance skip link functionality
    const skipLink = document.querySelector('.skip-link') as HTMLAnchorElement;
    if (skipLink) {
      skipLink.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          const mainContent = document.getElementById('main-content');
          if (mainContent) {
            mainContent.focus();
            mainContent.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          }
        },
        { signal: this.abortController.signal }
      );
    }

    // Add live region for screen reader announcements
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.id = 'nav-announcements';
    document.body.appendChild(liveRegion);
  }

  private announceToScreenReader(message: string): void {
    const liveRegion = document.getElementById('nav-announcements');
    if (liveRegion) {
      liveRegion.textContent = message;
      setTimeout(() => (liveRegion.textContent = ''), 1000);
    }
  }

  private cacheElements(): void {
    const categoryGroups = document.querySelectorAll('.category-group');

    categoryGroups.forEach((group: Element, index: number) => {
      const link = group.querySelector('.nav-item') as HTMLElement;
      const expandBtn = group.querySelector(
        '.mobile-expand-btn'
      ) as HTMLElement | null;
      const dropdown = group.querySelector('.dropdown-menu') as HTMLElement;
      // Category groups with subcategories have the expand button
      const hasChildren = expandBtn !== null;

      if (hasChildren && link && dropdown) {
        const prefetchStrategy =
          link.getAttribute('data-prefetch-strategy') || 'hover';
        const categoryName =
          expandBtn?.getAttribute('data-category-name') ||
          link.getAttribute('data-category-name') ||
          'Unknown';

        this.navElements.set(group, {
          link,
          expandBtn,
          dropdown,
          index,
          isOpen: false,
          prefetchStrategy,
          categoryName,
        });

        // Optimize for touch devices
        if ('ontouchstart' in window) {
          dropdown.style.contain = 'layout style';
        }
      }
    });
  }

  private setupEventDelegation(): void {
    const nav = document.querySelector('nav');
    if (!nav) return;

    // Use single event listener with delegation for better performance
    nav.addEventListener('click', this.handleClick.bind(this), {
      passive: false,
      signal: this.abortController.signal,
    });

    nav.addEventListener('focusout', this.handleFocusOut.bind(this), {
      passive: true,
      signal: this.abortController.signal,
    });

    // Optimized touch handling for mobile
    nav.addEventListener('touchstart', this.handleTouchStart.bind(this), {
      passive: true,
      signal: this.abortController.signal,
    });

    // Keyboard navigation enhancements
    nav.addEventListener('keydown', this.handleKeydown.bind(this), {
      signal: this.abortController.signal,
    });
  }

  private handleClick(event: Event): void {
    const target = event.target as HTMLElement;
    const clickedBtn = target.closest(
      '.mobile-expand-btn'
    ) as HTMLElement | null;
    if (!clickedBtn) return;

    // Always prevent default on the expand button (it's a <button>, not a link,
    // but guard here to avoid any accidental form submission)
    event.preventDefault();

    if (this.isAnimating) return;

    const group = clickedBtn.closest('.category-group');
    if (!group) return;

    const elementData = this.navElements.get(group);
    if (!elementData) return;

    // Only activate on mobile; on desktop the dropdown is CSS hover-driven
    if (window.innerWidth > 1024) return;

    this.toggleDropdown(group, elementData);
  }

  private handleKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const expandBtn = target.closest(
      '.mobile-expand-btn'
    ) as HTMLElement | null;

    if (expandBtn) {
      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          expandBtn.click();
          break;
        case 'ArrowDown':
          if (expandBtn.getAttribute('aria-expanded') === 'true') {
            event.preventDefault();
            this.focusFirstDropdownItem(expandBtn);
          }
          break;
      }
      return;
    }

    // Escape closes all menus regardless of focus location within nav
    if (event.key === 'Escape') {
      this.closeAllDropdowns();
      this.announceToScreenReader('All menus closed');
    }
  }

  private focusFirstDropdownItem(btn: HTMLElement): void {
    const group = btn.closest('.category-group');
    const dropdown = group?.querySelector('.dropdown-menu');
    const firstLink = dropdown?.querySelector('a') as HTMLElement;
    if (firstLink) {
      firstLink.focus();
    }
  }

  private toggleDropdown(group: Element, elementData: NavElementData): void {
    // Use requestAnimationFrame for smooth animations
    requestAnimationFrame(() => {
      try {
        this.isAnimating = true;

        this.closeOtherDropdowns(group);

        const wasOpen = elementData.isOpen;
        this.setDropdownState(group, elementData, !wasOpen);

        // Announce state change for screen readers
        const action = wasOpen ? 'collapsed' : 'expanded';
        this.announceToScreenReader(
          `${elementData.categoryName} menu ${action}`
        );

        // Use shorter animation timeout for better responsiveness
        setTimeout(() => {
          this.isAnimating = false;
        }, 200);
      } catch (error) {
        // Ensure isAnimating gets reset even if errors occur
        this.isAnimating = false;
        throw error;
      }
    });
  }

  private closeOtherDropdowns(excludeGroup: Element): void {
    const updates: (() => void)[] = [];

    this.navElements.forEach((elementData: NavElementData, group: Element) => {
      if (group !== excludeGroup && elementData.isOpen) {
        updates.push(() => this.setDropdownState(group, elementData, false));
      }
    });

    if (updates.length) {
      requestAnimationFrame(() => {
        updates.forEach((update) => update());
      });
    }
  }

  private setDropdownState(
    group: Element,
    elementData: NavElementData,
    isOpen: boolean
  ): void {
    elementData.isOpen = isOpen;
    const { expandBtn, dropdown } = elementData;

    // Batch DOM updates for better performance
    requestAnimationFrame(() => {
      if (isOpen) {
        group.classList.add('open');
        expandBtn?.setAttribute('aria-expanded', 'true');
        expandBtn?.setAttribute(
          'aria-label',
          `Collapse ${elementData.categoryName} subcategories`
        );
        (dropdown as HTMLElement).style.contain = 'layout style';
      } else {
        group.classList.remove('open');
        expandBtn?.setAttribute('aria-expanded', 'false');
        expandBtn?.setAttribute(
          'aria-label',
          `Expand ${elementData.categoryName} subcategories`
        );
        (dropdown as HTMLElement).style.contain = '';
      }
    });
  }

  private handleFocusOut(event: Event): void {
    if (this.focusTimeout) {
      clearTimeout(this.focusTimeout);
    }

    this.focusTimeout = window.setTimeout(() => {
      const nav = event.currentTarget as HTMLElement;
      if (nav && !nav.contains(document.activeElement)) {
        this.closeAllDropdowns();
      }
    }, 0);
  }

  private handleTouchStart(event: Event): void {
    const target = event.target as HTMLElement;
    const group = target.closest('.category-group');
    if (group && this.navElements.has(group)) {
      // Optimize for touch by preparing for animation
      (group as HTMLElement).style.willChange = 'transform';

      // Clean up after interaction
      setTimeout(() => {
        (group as HTMLElement).style.willChange = 'auto';
      }, 300);
    }
  }

  private closeAllDropdowns(): void {
    requestAnimationFrame(() => {
      this.navElements.forEach(
        (elementData: NavElementData, group: Element) => {
          if (elementData.isOpen) {
            this.setDropdownState(group, elementData, false);
          }
        }
      );
    });
  }

  private setupResizeObserver(): void {
    // Use ResizeObserver for better performance than resize events
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 1024) {
          this.closeAllDropdowns();
        }
      }
    });

    this.resizeObserver.observe(document.documentElement);
  }

  private setupOverlay(): void {
    this.overlay = document.getElementById('nav-overlay');
    const nav = document.getElementById('main-nav');
    if (!this.overlay || !nav) return;

    // Portal the overlay to <body> so it escapes the header's stacking
    // context. Inside the header (z-50), z-30 would sit above the header's
    // own content. In the root stacking context, z-30 correctly appears
    // above page content (z-auto) but below the header (z-50) and nav panel.
    document.body.appendChild(this.overlay);

    this.overlayObserver = new MutationObserver(() => {
      const isMobileOrTablet = window.innerWidth < 1024;
      if (nav.classList.contains('nav-open') && isMobileOrTablet) {
        this.showOverlay();
      } else {
        this.hideOverlay();
      }
    });

    this.overlayObserver.observe(nav, {
      attributes: true,
      attributeFilter: ['class'],
    });

    window.addEventListener(
      'resize',
      () => {
        const isMobileOrTablet = window.innerWidth < 1024;
        if (!nav.classList.contains('nav-open') || !isMobileOrTablet) {
          this.hideOverlay();
        }
      },
      { signal: this.abortController.signal }
    );
  }

  private showOverlay(): void {
    if (!this.overlay) return;
    this.overlay.classList.remove('hidden');
    // Force reflow so the display:block state is committed before the
    // opacity transition starts — more reliable than requestAnimationFrame
    // in background/throttled contexts.
    void this.overlay.offsetHeight;
    this.overlay.classList.remove('opacity-0');
  }

  private hideOverlay(): void {
    if (!this.overlay) return;
    this.overlay.classList.add('opacity-0');
    setTimeout(() => {
      this.overlay?.classList.add('hidden');
    }, 300);
  }

  public destroy(): void {
    if (this.focusTimeout) {
      clearTimeout(this.focusTimeout);
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    if (this.overlayObserver) {
      this.overlayObserver.disconnect();
      this.overlayObserver = null;
    }

    this.overlay?.classList.add('opacity-0');
    this.overlay?.classList.add('hidden');

    this.abortController.abort();
    this.navElements.clear();

    // Clean up live region
    const liveRegion = document.getElementById('nav-announcements');
    if (liveRegion) {
      liveRegion.remove();
    }
  }
}

function initializeOptimizedNavigation(): OptimizedNavigationController {
  const navController = new OptimizedNavigationController();

  return navController;
}

// Called once from Nav.astro's script tag. This module does NOT re-execute on
// a view-transition swap, so the swap/visibility/bfcache wiring below is
// registered once here, and the controller is rebuilt from those handlers.
let initialized = false;

export function init(): void {
  if (initialized) return;
  initialized = true;

  // Keep existing Astro page transition handling
  let navController: OptimizedNavigationController | null = null;

  document.addEventListener('astro:before-swap', () => {
    if (navController) {
      navController.destroy();
      navController = null;
    }
  });

  document.addEventListener('astro:after-swap', () => {
    navController = initializeOptimizedNavigation();
  });

  // Handle page visibility changes to prevent stale state
  // Only runs after extended idle periods (5+ minutes)
  let hiddenTime = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Track when page was hidden
      hiddenTime = Date.now();
    } else {
      // Page is visible again - only reset if hidden for more than 5 minutes
      const idleDuration = Date.now() - hiddenTime;
      if (hiddenTime > 0 && idleDuration > 300000) {
        // 5 minutes
        if (navController) {
          navController.destroy();
        }
        navController = initializeOptimizedNavigation();
      }
    }
  });

  // Handle page show event (back/forward cache)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      // Page loaded from bfcache - reset cSpell:ignore bfcache
      if (navController) {
        navController.destroy();
      }
      navController = initializeOptimizedNavigation();
    }
  });

  // Initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      navController = initializeOptimizedNavigation();
    });
  } else {
    navController = initializeOptimizedNavigation();
  }
}
