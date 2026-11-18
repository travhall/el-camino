import { FilterCoordinator } from '@/lib/filterCoordinator';

// ── Pill rendering ──────────────────────────────────────────────────────────

const PILL_WRAP_CLASS =
  'shrink-0 inline-flex items-center gap-0.5 pl-3 pr-1 py-1.5 text-sm border rounded-full bg-(--surface-primary) text-(--ui-input-text) border-(--ui-input-border)/50';

const REMOVE_BTN_CLASS =
  'inline-flex items-center justify-center rounded-full p-2.5 -m-0.5 text-(--content-meta) hover:text-(--content-body) hover:bg-(--surface-tertiary) transition-colors';

const REMOVE_BTN_CLASS_GREEN =
  'inline-flex items-center justify-center rounded-full p-2.5 -m-0.5 text-(--state-success-text)/70 hover:text-(--state-success-text) hover:bg-(--surface-tertiary) transition-colors';

const X_ICON = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>`;

function buildPill(
  label: string,
  removeBtnClass: string,
  ariaLabel: string,
  configureBtn: (btn: HTMLButtonElement) => void
): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = PILL_WRAP_CLASS;

  const labelSpan = document.createElement('span');
  labelSpan.className = 'relative z-10';
  labelSpan.textContent = label;
  wrap.appendChild(labelSpan);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = removeBtnClass;
  btn.setAttribute('aria-label', ariaLabel);
  btn.title = ariaLabel;
  btn.insertAdjacentHTML('beforeend', X_ICON);
  configureBtn(btn);
  wrap.appendChild(btn);

  return wrap;
}

function appendPills(
  row: HTMLElement,
  brands: string[],
  categories: string[],
  availability: boolean,
  categoryNames: Record<string, string>,
  onSale: boolean
) {
  brands.forEach((brand) => {
    row.appendChild(
      buildPill(brand, REMOVE_BTN_CLASS, `Remove ${brand} filter`, (btn) => {
        btn.dataset.removeBrand = brand;
      })
    );
  });

  categories.forEach((slug) => {
    const name = categoryNames[slug] || slug;
    row.appendChild(
      buildPill(name, REMOVE_BTN_CLASS, `Remove ${name} filter`, (btn) => {
        btn.dataset.filterType = 'categories';
        btn.dataset.filterValue = slug;
      })
    );
  });

  if (availability) {
    row.appendChild(
      buildPill(
        'In stock only',
        REMOVE_BTN_CLASS_GREEN,
        'Remove in stock only filter',
        (btn) => {
          btn.dataset.removeAvailability = '';
        }
      )
    );
  }

  if (onSale) {
    row.appendChild(
      buildPill(
        'On sale only',
        REMOVE_BTN_CLASS,
        'Remove on sale only filter',
        (btn) => {
          btn.dataset.removeOnSale = '';
        }
      )
    );
  }
}

// ── Focus + announcement bookkeeping ─────────────────────────────────────────
// Set right before a chip-driven filter change is dispatched (click handlers
// below), then consumed once at the tail of updateAppliedFilters. Stays null
// for filter changes that originate elsewhere (e.g. the desktop sidebar),
// so this component doesn't steal focus for changes it didn't cause.

let pendingFocusIndex: number | null = null;
let pendingRemovedLabel: string | null = null;

function getRemoveButtons(): HTMLElement[] {
  const row = document.getElementById('applied-filters-row');
  if (!row) return [];
  return Array.from(
    row.querySelectorAll<HTMLElement>(
      "[data-remove-brand], [data-filter-type='categories'], [data-remove-availability], [data-remove-on-sale]"
    )
  );
}

function focusFallback(container: HTMLElement) {
  // Last chip removed — the container is about to be hidden, so move focus
  // to the page heading rather than an element that's leaving the a11y tree.
  const heading = document.querySelector('h1') as HTMLElement | null;
  if (heading) {
    if (!heading.hasAttribute('tabindex'))
      heading.setAttribute('tabindex', '-1');
    heading.focus();
  } else {
    container.focus();
  }
}

function announceRemoval() {
  if (!pendingRemovedLabel) return;
  const region = document.getElementById('applied-filters-live-region');
  if (region) {
    region.textContent = '';
    const label = pendingRemovedLabel;
    window.setTimeout(() => {
      region.textContent = `${label} filter removed`;
    }, 50);
  }
  pendingRemovedLabel = null;
}

function updateAppliedFilters(
  brands: string[],
  categories: string[],
  availability: boolean,
  onSale: boolean = false
) {
  const container = document.getElementById('applied-filters-container');
  const row = document.getElementById('applied-filters-row');
  if (!container || !row) return;

  const hasActive =
    brands.length > 0 || categories.length > 0 || availability || onSale;

  if (!hasActive) {
    // Focus while still visible — a hidden/removed element can't take focus.
    if (pendingFocusIndex !== null) focusFallback(container);
    container.classList.add('no-filters');
    row.innerHTML = '';
    pendingFocusIndex = null;
    announceRemoval();
    return;
  }

  container.classList.remove('no-filters');

  const categoryNames = JSON.parse(
    container.dataset.categoryNames || '{}'
  ) as Record<string, string>;

  row.innerHTML = '';
  appendPills(row, brands, categories, availability, categoryNames, onSale);

  const clearAllBtn = document.createElement('button');
  clearAllBtn.type = 'button';
  clearAllBtn.dataset.clearAllFilters = '';
  clearAllBtn.className =
    'shrink-0 text-sm text-(--content-meta) hover:text-(--content-emphasis) transition-colors text-nowrap';
  clearAllBtn.textContent = 'Clear All';
  row.appendChild(clearAllBtn);

  setupFilterHandlers();

  if (pendingFocusIndex !== null) {
    const buttons = getRemoveButtons();
    if (buttons.length === 0) {
      focusFallback(container);
    } else {
      buttons[Math.min(pendingFocusIndex, buttons.length - 1)]?.focus();
    }
    pendingFocusIndex = null;
  }
  announceRemoval();
}

// ── Filter state manipulation cSpell:ignore filterchange ────────────────────────────────────────────────

function dispatchFilterChange(
  brands: string[],
  categories: string[],
  availability: boolean,
  onSale: boolean = false
) {
  const params = new URLSearchParams();
  brands.forEach((b) => params.append('brands', b));
  categories.forEach((c) => params.append('categories', c));
  if (availability) params.set('availability', 'true');
  if (onSale) params.set('onSale', 'true');
  const qs = params.toString();
  history.pushState({}, '', `${window.location.pathname}${qs ? '?' + qs : ''}`);
  window.dispatchEvent(
    new CustomEvent('filterchange', {
      detail: { brands, categories, availability, onSale },
    })
  );
}

function removeFilter(type: string, value: string | null = null) {
  const p = new URLSearchParams(window.location.search);
  const brands = p.getAll('brands');
  const cats = p.getAll('categories');
  const avail = p.get('availability') === 'true';
  const sale = p.get('onSale') === 'true';

  if (type === 'brand' && value) {
    dispatchFilterChange(
      brands.filter((b) => b !== value),
      cats,
      avail,
      sale
    );
  } else if (type === 'categories' && value) {
    dispatchFilterChange(
      brands,
      cats.filter((c) => c !== value),
      avail,
      sale
    );
  } else if (type === 'availability') {
    dispatchFilterChange(brands, cats, false, sale);
  } else if (type === 'onSale') {
    dispatchFilterChange(brands, cats, avail, false);
  }
}

// ── Event handler setup ──────────────────────────────────────────────────────

function setupFilterHandlers() {
  document
    .querySelectorAll<HTMLElement>('[data-remove-brand]')
    .forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const brand = target.dataset.removeBrand;
        if (brand) {
          pendingFocusIndex = getRemoveButtons().indexOf(target);
          pendingRemovedLabel = brand;
          removeFilter('brand', brand);
        }
      });
    });

  document
    .querySelectorAll<HTMLElement>("[data-filter-type='categories']")
    .forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const slug = target.dataset.filterValue;
        if (slug) {
          pendingFocusIndex = getRemoveButtons().indexOf(target);
          pendingRemovedLabel =
            target
              .getAttribute('aria-label')
              ?.replace(/^Remove /, '')
              .replace(/ filter$/, '') ?? slug;
          removeFilter('categories', slug);
        }
      });
    });

  document
    .querySelector<HTMLElement>('[data-remove-availability]')
    ?.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      pendingFocusIndex = getRemoveButtons().indexOf(target);
      pendingRemovedLabel = 'In stock only';
      removeFilter('availability');
    });

  document
    .querySelector<HTMLElement>('[data-remove-on-sale]')
    ?.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      pendingFocusIndex = getRemoveButtons().indexOf(target);
      pendingRemovedLabel = 'On sale only';
      removeFilter('onSale');
    });

  document
    .querySelector('[data-clear-all-filters]')
    ?.addEventListener('click', () => {
      pendingFocusIndex = 0;
      pendingRemovedLabel = 'All';
      dispatchFilterChange([], [], false, false);
    });
}

let initialized = false;

// Called once from AppliedFilters.astro's script tag. This module does NOT
// re-execute on a view-transition swap, so the filterchange listener is
// registered once here, and the chip handlers are re-bound on every
// astro:page-load because each swap brings a fresh DOM.
export function init(): void {
  if (initialized) return;
  initialized = true;

  FilterCoordinator.initialize();

  window.addEventListener('filterchange', (e: Event) => {
    const evt = e as CustomEvent<{
      brands: string[];
      categories: string[];
      availability: boolean;
      onSale?: boolean;
    }>;
    updateAppliedFilters(
      evt.detail.brands,
      evt.detail.categories,
      evt.detail.availability,
      evt.detail.onSale ?? false
    );
  });

  document.addEventListener('astro:page-load', () => {
    setupFilterHandlers();
  });
}
