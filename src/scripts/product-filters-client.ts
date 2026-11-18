import { FilterCoordinator } from '@/lib/filterCoordinator';

// Section state keys in sessionStorage
const SECTION_KEYS: Record<string, string> = {
  brand: 'filter-section-brand',
  category: 'filter-section-category',
};

// ── Module-level: update UI from filter state ────────────────────────────────

function updateCheckboxStates(
  brands: string[],
  categories: string[],
  availability: boolean,
  onSale: boolean
) {
  const form = document.getElementById('filter-form') as HTMLFormElement | null;
  if (!form) return;
  form
    .querySelectorAll<HTMLInputElement>('input[name="brands"]')
    .forEach((cb) => {
      cb.checked = brands.includes(cb.value);
    });
  form
    .querySelectorAll<HTMLInputElement>('input[name="categories"]')
    .forEach((cb) => {
      cb.checked = categories.includes(cb.value);
    });
  const availCb = form.querySelector<HTMLInputElement>(
    'input[name="availability"]'
  );
  if (availCb) availCb.checked = availability;
  const onSaleCb = form.querySelector<HTMLInputElement>('input[name="onSale"]');
  if (onSaleCb) onSaleCb.checked = onSale;
}

function updateSectionBadges(
  brands: string[],
  categories: string[],
  availability: boolean,
  onSale: boolean
) {
  // Brand badge
  const brandBadge = document.querySelector<HTMLElement>('[data-brand-badge]');
  if (brandBadge) {
    brandBadge.textContent = brands.length > 0 ? String(brands.length) : '';
    brandBadge.style.display = brands.length > 0 ? '' : 'none';
  }
  // Brand clear button
  const clearBrandsBtn = document.querySelector<HTMLElement>(
    '[data-clear-brands]'
  );
  if (clearBrandsBtn)
    clearBrandsBtn.style.display = brands.length > 0 ? '' : 'none';

  // Category badge
  const categoryBadge = document.querySelector<HTMLElement>(
    '[data-category-badge]'
  );
  if (categoryBadge) {
    categoryBadge.textContent =
      categories.length > 0 ? String(categories.length) : '';
    categoryBadge.style.display = categories.length > 0 ? '' : 'none';
  }
  // Category clear button
  const clearCategoriesBtn = document.querySelector<HTMLElement>(
    '[data-clear-categories]'
  );
  if (clearCategoriesBtn)
    clearCategoriesBtn.style.display = categories.length > 0 ? '' : 'none';

  // Availability badge
  const availBadge = document.querySelector<HTMLElement>(
    '[data-availability-badge]'
  );
  if (availBadge) availBadge.style.display = availability ? '' : 'none';

  // Mobile button badge
  const total =
    brands.length +
    categories.length +
    (availability ? 1 : 0) +
    (onSale ? 1 : 0);
  const mobileBadge = document.querySelector<HTMLElement>(
    '[data-mobile-filter-badge]'
  );
  if (mobileBadge) {
    mobileBadge.textContent = total > 0 ? String(total) : '';
    mobileBadge.style.display = total > 0 ? '' : 'none';
  }

  // Mobile "Clear Filters" button
  const clearMobileBtn = document.querySelector<HTMLElement>(
    '[data-clear-filters-mobile]'
  );
  if (clearMobileBtn) clearMobileBtn.style.display = total > 0 ? '' : 'none';
}

function updateCountDisplay(count: number, total: number) {
  document.querySelectorAll('[data-result-count]').forEach((el) => {
    el.textContent =
      count === total ? `${total} products` : `${count} of ${total} products`;
  });
  // Show/hide "Clear all" button
  const clearBtn = document.querySelector<HTMLElement>('[data-clear-filters]');
  if (clearBtn) clearBtn.style.display = count < total ? '' : 'none';
  // Live region for screen readers
  const liveRegion = document.getElementById('filter-results-live-region');
  if (liveRegion) {
    setTimeout(() => {
      liveRegion.textContent =
        count === total
          ? `Showing all ${total} products`
          : `Filtered to ${count} of ${total} products`;
    }, 100);
  }
}

// ── ProductFilters class ─────────────────────────────────────────────────────

class ProductFilters {
  private form: HTMLFormElement | null = null;
  private container: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private abortController = new AbortController();

  constructor() {
    this.form = document.getElementById('filter-form') as HTMLFormElement;
    this.container = document.getElementById('filter-container');
    this.overlay = document.getElementById('mobile-filter-overlay');

    if (!this.form) return;

    this.setupMobileDrawer();
    this.setupHybridFiltering();
    this.setupAccordions();
    this.setupClearButtons();
  }

  // Mobile (< 768px): bottom drawer / Tablet (768–1023px): right panel
  private isNarrowMobile(): boolean {
    return window.innerWidth < 768;
  }

  private initClosedState(): void {
    if (!this.container) return;
    if (window.innerWidth >= 1024) {
      // Desktop: lg: CSS handles visibility; clear any translate classes
      this.container.classList.remove('translate-x-full', 'translate-y-full');
      return;
    }
    if (this.isNarrowMobile()) {
      this.container.classList.remove('translate-x-full');
      this.container.classList.add('translate-y-full');
    } else {
      this.container.classList.remove('translate-y-full');
      this.container.classList.add('translate-x-full');
    }
  }

  private setupMobileDrawer(): void {
    const toggle = document.getElementById('mobile-filter-toggle');
    const close = document.getElementById('mobile-filter-close');
    const { signal } = this.abortController;

    this.initClosedState();

    toggle?.addEventListener('click', () => this.openMobileDrawer(), {
      signal,
    });
    close?.addEventListener('click', () => this.closeMobileDrawer(), {
      signal,
    });
    this.overlay?.addEventListener('click', () => this.closeMobileDrawer(), {
      signal,
    });

    // When crossing the mobile/tablet boundary while drawer is closed, update
    // the hidden transform so it re-enters from the correct edge.
    window.addEventListener(
      'resize',
      () => {
        if (this.container?.classList.contains('opacity-0')) {
          this.initClosedState();
        }
      },
      { signal }
    );
  }

  private openMobileDrawer(): void {
    // Lower the header below <main>'s stacking context (z-10) so the filter
    // panel and overlay — which live inside <main> — can paint above it,
    // matching MiniCart's behavior. Body overflow:hidden prevents any scroll
    // that would expose the header being temporarily behind main content.
    const header = document.getElementById('site-header');
    if (header) header.style.zIndex = '9';

    this.overlay?.classList.remove('pointer-events-none', 'opacity-0');
    if (this.isNarrowMobile()) {
      this.container?.classList.remove(
        'translate-y-full',
        'opacity-0',
        'pointer-events-none'
      );
    } else {
      this.container?.classList.remove(
        'translate-x-full',
        'opacity-0',
        'pointer-events-none'
      );
    }
    document.body.style.overflow = 'hidden';
  }

  private closeMobileDrawer(): void {
    this.overlay?.classList.add('opacity-0');
    if (this.isNarrowMobile()) {
      this.container?.classList.add('translate-y-full', 'opacity-0');
    } else {
      this.container?.classList.add('translate-x-full', 'opacity-0');
    }

    let hasCompleted = false;
    const handleTransitionEnd = () => {
      if (hasCompleted) return;
      hasCompleted = true;
      this.overlay?.classList.add('pointer-events-none');
      this.container?.classList.add('pointer-events-none');
      const header = document.getElementById('site-header');
      if (header) header.style.zIndex = '';
    };

    this.container?.addEventListener('transitionend', handleTransitionEnd, {
      once: true,
    });
    setTimeout(handleTransitionEnd, 350);
    document.body.style.overflow = '';
  }

  private setupHybridFiltering(): void {
    if (!this.form) return;

    const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;
    const { signal } = this.abortController;

    this.form.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        if (!isDesktop()) {
          this.closeMobileDrawer();
          setTimeout(() => this.submitForm(), 300);
        } else {
          this.submitForm();
        }
      },
      { signal }
    );

    this.form.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener(
        'change',
        () => {
          if (isDesktop()) this.submitForm();
        },
        { signal }
      );
    });
  }

  private submitForm(): void {
    const formData = new FormData(this.form!);
    const params = new URLSearchParams();

    const brands = formData.getAll('brands') as string[];
    const categories = formData.getAll('categories') as string[];
    const availability = formData.get('availability') === 'true';
    const onSale = formData.get('onSale') === 'true';

    brands.forEach((b) => params.append('brands', b));
    categories.forEach((c) => params.append('categories', c));
    if (availability) params.set('availability', 'true');
    if (onSale) params.set('onSale', 'true');

    const queryString = params.toString();
    const newUrl = `${window.location.pathname}${queryString ? '?' + queryString : ''}`;

    history.pushState({}, '', newUrl);
    window.dispatchEvent(
      new CustomEvent('filterchange', {
        detail: { brands, categories, availability, onSale },
      })
    );
  }

  private setupAccordions(): void {
    document
      .querySelectorAll<HTMLButtonElement>('[data-section-toggle]')
      .forEach((btn) => {
        const section = btn.dataset.sectionToggle!;
        const contentId = btn.getAttribute('aria-controls')!;
        const contentEl = document.getElementById(contentId);
        if (!contentEl) return;

        // The chevron is a sibling SVG in the same header row (not inside the button)
        const chevron = btn
          .closest('.filter-section')
          ?.querySelector<SVGElement>('.filter-chevron');

        // Restore saved state
        const storageKey = SECTION_KEYS[section];
        const savedState = storageKey
          ? sessionStorage.getItem(storageKey)
          : null;

        if (savedState === 'closed') {
          // Suppress transition so state restoration doesn't animate on page load
          contentEl.style.transition = 'none';
          contentEl.classList.add('is-closed');
          btn.setAttribute('aria-expanded', 'false');
          chevron?.classList.add('is-collapsed');
          // Re-enable after two frames (browser has committed the layout)
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              contentEl.style.transition = '';
            })
          );
        }

        btn.addEventListener(
          'click',
          () => {
            const isClosed = contentEl.classList.contains('is-closed');
            if (isClosed) {
              contentEl.classList.remove('is-closed');
              btn.setAttribute('aria-expanded', 'true');
              chevron?.classList.remove('is-collapsed');
              if (storageKey) sessionStorage.setItem(storageKey, 'open');
            } else {
              contentEl.classList.add('is-closed');
              btn.setAttribute('aria-expanded', 'false');
              chevron?.classList.add('is-collapsed');
              if (storageKey) sessionStorage.setItem(storageKey, 'closed');
            }
          },
          { signal: this.abortController.signal }
        );
      });
  }

  private setupClearButtons(): void {
    const { signal } = this.abortController;

    document.querySelectorAll('[data-clear-filters]').forEach((btn) => {
      btn.addEventListener('click', () => this.clearAllFilters(), { signal });
    });

    document.querySelector('[data-clear-filters-mobile]')?.addEventListener(
      'click',
      () => {
        this.closeMobileDrawer();
        setTimeout(() => this.clearAllFilters(), 100);
      },
      { signal }
    );

    document.querySelector('[data-clear-brands]')?.addEventListener(
      'click',
      () => {
        this.form
          ?.querySelectorAll<HTMLInputElement>('input[name="brands"]')
          .forEach((cb) => {
            cb.checked = false;
          });
        if (window.matchMedia('(min-width: 1024px)').matches) this.submitForm();
      },
      { signal }
    );

    document.querySelector('[data-clear-categories]')?.addEventListener(
      'click',
      () => {
        this.form
          ?.querySelectorAll<HTMLInputElement>('input[name="categories"]')
          .forEach((cb) => {
            cb.checked = false;
          });
        if (window.matchMedia('(min-width: 1024px)').matches) this.submitForm();
      },
      { signal }
    );
  }

  public clearAllFilters(): void {
    history.pushState({}, '', window.location.pathname);
    window.dispatchEvent(
      new CustomEvent('filterchange', {
        detail: {
          brands: [],
          categories: [],
          availability: false,
          onSale: false,
        },
      })
    );
  }

  public destroy(): void {
    this.abortController.abort();
    document.body.style.overflow = '';
    const header = document.getElementById('site-header');
    if (header) header.style.zIndex = '';
  }
}

let currentInstance: ProductFilters | null = null;

let initialized = false;

// Called once from ProductFilters.astro's script tag. This module does NOT
// re-execute on a view-transition swap, so the window/document listeners are
// registered once here (in the original order), and a fresh ProductFilters
// instance is built on every astro:page-load and torn down on
// astro:before-preparation.
export function init(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener('filterresult', (e: Event) => {
    const evt = e as CustomEvent<{ count: number; total: number }>;
    updateCountDisplay(evt.detail.count, evt.detail.total);
  });

  window.addEventListener('filterchange', (e: Event) => {
    const evt = e as CustomEvent<{
      brands: string[];
      categories: string[];
      availability: boolean;
      onSale?: boolean;
    }>;
    const { brands, categories, availability, onSale = false } = evt.detail;
    updateCheckboxStates(brands, categories, availability, onSale);
    updateSectionBadges(brands, categories, availability, onSale);
    const hasFilters =
      brands.length > 0 || categories.length > 0 || availability || onSale;
    const clearBtn = document.querySelector<HTMLElement>(
      '[data-clear-filters]'
    );
    if (clearBtn) clearBtn.style.display = hasFilters ? '' : 'none';
  });

  document.addEventListener('astro:before-preparation', () => {
    const container = document.getElementById('filter-container');
    if (container && window.innerWidth < 1024) {
      const cls =
        window.innerWidth < 768 ? 'translate-y-full' : 'translate-x-full';
      container.classList.add(cls, 'opacity-0', 'pointer-events-none');
    }
    document
      .getElementById('mobile-filter-overlay')
      ?.classList.add('pointer-events-none', 'opacity-0');
    document.body.style.overflow = '';
  });

  document.addEventListener('astro:after-swap', () => {
    // Ensure incoming cards start invisible so entrance animation plays correctly
    document
      .querySelectorAll<HTMLElement>('.product-card-wrapper')
      .forEach((card) => {
        if (!card.classList.contains('opacity-100')) {
          card.classList.add('opacity-0');
        }
      });
  });

  document.addEventListener('astro:page-load', () => {
    const grid = document.getElementById('filterable-product-grid');
    if (grid) {
      grid.style.visibility = 'visible';
      grid.style.opacity = '1';
    }
    document.body.classList.remove('filtering-in-progress');
  });

  FilterCoordinator.initialize();

  document.addEventListener('astro:page-load', () => {
    currentInstance?.destroy();
    currentInstance = new ProductFilters();
  });

  document.addEventListener('astro:before-preparation', () => {
    currentInstance?.destroy();
    currentInstance = null;
    FilterCoordinator.reset();
  });
}
