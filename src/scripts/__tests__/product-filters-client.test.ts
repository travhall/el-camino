/**
 * Characterization tests for product-filters-client (plan 226, extracted from
 * the inline script in ProductFilters.astro). Each test does a fresh
 * `vi.resetModules()` + dynamic import because the module holds module-level
 * state (the `initialized` guard and the current ProductFilters instance).
 *
 * The module registers listeners on `window` and `document` that outlive a
 * test, so every `addEventListener` call on them is recorded in `beforeEach`
 * and undone in `afterEach`; otherwise an earlier test's copy of the module
 * would also react to the events a later test dispatches.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { initializeCoordinator, resetCoordinator } = vi.hoisted(() => ({
  initializeCoordinator: vi.fn(),
  resetCoordinator: vi.fn(),
}));

vi.mock('@/lib/filterCoordinator', () => ({
  FilterCoordinator: {
    initialize: initializeCoordinator,
    reset: resetCoordinator,
  },
}));

type Recorded = {
  target: Window | Document;
  type: string;
  listener: EventListenerOrEventListenerObject;
};
let recorded: Recorded[] = [];

function setViewport(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
    writable: true,
  });
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width: 1024px') ? width >= 1024 : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

function setupDom(): void {
  document.body.removeAttribute('class');
  document.body.style.overflow = '';
  document.body.innerHTML = `
    <header id="site-header"></header>
    <button id="mobile-filter-toggle" type="button">Filters</button>
    <span data-mobile-filter-badge></span>
    <div id="mobile-filter-overlay" class="pointer-events-none opacity-0"></div>
    <div id="filter-container" class="opacity-0 pointer-events-none translate-y-full">
      <button id="mobile-filter-close" type="button">Close</button>
      <form id="filter-form">
        <div class="filter-section">
          <button type="button" data-section-toggle="brand" aria-controls="brand-content" aria-expanded="true"></button>
          <svg class="filter-chevron"></svg>
          <span data-brand-badge></span>
          <button type="button" data-clear-brands>Clear brands</button>
          <div id="brand-content">
            <input type="checkbox" name="brands" value="Baker">
            <input type="checkbox" name="brands" value="Spitfire">
          </div>
        </div>
        <div class="filter-section">
          <button type="button" data-section-toggle="category" aria-controls="category-content" aria-expanded="true"></button>
          <svg class="filter-chevron"></svg>
          <span data-category-badge></span>
          <button type="button" data-clear-categories>Clear categories</button>
          <div id="category-content">
            <input type="checkbox" name="categories" value="trucks">
          </div>
        </div>
        <input type="checkbox" name="availability" value="true">
        <span data-availability-badge></span>
        <input type="checkbox" name="onSale" value="true">
      </form>
      <button type="button" data-clear-filters-mobile>Clear Filters</button>
    </div>
    <button type="button" data-clear-filters>Clear all</button>
    <span data-result-count></span>
    <span data-result-count></span>
    <div id="filter-results-live-region"></div>
    <div id="filterable-product-grid" style="visibility:hidden;opacity:0"></div>
    <div class="product-card-wrapper" id="card-a"></div>
    <div class="product-card-wrapper opacity-100" id="card-b"></div>
  `;
}

async function freshInit() {
  vi.resetModules();
  const mod = await import('../product-filters-client');
  mod.init();
  return mod;
}

/** What the page does once Astro finishes loading: builds the instance. */
function pageLoad(): void {
  document.dispatchEvent(new Event('astro:page-load'));
}

function emitFilterChange(detail: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent('filterchange', { detail }));
}

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector(selector) as T;
const $$ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  [...document.querySelectorAll(selector)] as T[];
const checkbox = (name: string, value?: string) =>
  $<HTMLInputElement>(
    `input[name="${name}"]${value ? `[value="${value}"]` : ''}`
  );

function filterChanges(): Array<Record<string, unknown>> {
  const seen: Array<Record<string, unknown>> = [];
  const listener = (e: Event) =>
    seen.push((e as CustomEvent).detail as Record<string, unknown>);
  window.addEventListener('filterchange', listener);
  return seen;
}

function tick(box: HTMLInputElement, checked: boolean): void {
  box.checked = checked;
  box.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('product-filters-client', () => {
  beforeEach(() => {
    recorded = [];
    for (const target of [window, document] as const) {
      const original = target.addEventListener.bind(target) as (
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
      ) => void;
      vi.spyOn(target, 'addEventListener').mockImplementation(
        (type: string, listener: unknown, options?: unknown) => {
          recorded.push({
            target,
            type,
            listener: listener as EventListenerOrEventListenerObject,
          });
          original(
            type,
            listener as EventListenerOrEventListenerObject,
            options as boolean | AddEventListenerOptions
          );
        }
      );
    }
    initializeCoordinator.mockClear();
    resetCoordinator.mockClear();
    sessionStorage.clear();
    window.history.pushState({}, '', '/category/decks');
    setViewport(1280);
    setupDom();
  });

  afterEach(() => {
    for (const { target, type, listener } of recorded) {
      target.removeEventListener(type, listener);
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
    document.body.removeAttribute('class');
    document.body.style.overflow = '';
  });

  describe('init', () => {
    it('initializes the FilterCoordinator once', async () => {
      await freshInit();
      expect(initializeCoordinator).toHaveBeenCalledTimes(1);
    });

    it('is guarded: a second init() registers no further listeners', async () => {
      const mod = await freshInit();
      const before = recorded.length;
      mod.init();

      expect(recorded).toHaveLength(before);
      expect(initializeCoordinator).toHaveBeenCalledTimes(1);
    });
  });

  describe('filterchange: syncing the form and badges', () => {
    it('checks exactly the boxes in the new state and unchecks the rest', async () => {
      await freshInit();
      checkbox('brands', 'Spitfire').checked = true;

      emitFilterChange({
        brands: ['Baker'],
        categories: ['trucks'],
        availability: true,
        onSale: true,
      });

      expect(checkbox('brands', 'Baker').checked).toBe(true);
      expect(checkbox('brands', 'Spitfire').checked).toBe(false);
      expect(checkbox('categories', 'trucks').checked).toBe(true);
      expect(checkbox('availability').checked).toBe(true);
      expect(checkbox('onSale').checked).toBe(true);
    });

    it('shows counts on the section badges and reveals the clear buttons', async () => {
      await freshInit();

      emitFilterChange({
        brands: ['Baker', 'Spitfire'],
        categories: ['trucks'],
        availability: true,
        onSale: false,
      });

      expect($('[data-brand-badge]').textContent).toBe('2');
      expect($('[data-brand-badge]').style.display).toBe('');
      expect($('[data-clear-brands]').style.display).toBe('');
      expect($('[data-category-badge]').textContent).toBe('1');
      expect($('[data-clear-categories]').style.display).toBe('');
      expect($('[data-availability-badge]').style.display).toBe('');
      expect($('[data-clear-filters]').style.display).toBe('');
    });

    it('counts availability and on-sale in the mobile badge total', async () => {
      await freshInit();

      emitFilterChange({
        brands: ['Baker'],
        categories: ['trucks'],
        availability: true,
        onSale: true,
      });

      expect($('[data-mobile-filter-badge]').textContent).toBe('4');
      expect($('[data-mobile-filter-badge]').style.display).toBe('');
      expect($('[data-clear-filters-mobile]').style.display).toBe('');
    });

    it('hides every badge and clear button when nothing is selected', async () => {
      await freshInit();
      emitFilterChange({
        brands: ['Baker'],
        categories: ['trucks'],
        availability: true,
        onSale: true,
      });

      emitFilterChange({
        brands: [],
        categories: [],
        availability: false,
        onSale: false,
      });

      for (const selector of [
        '[data-brand-badge]',
        '[data-clear-brands]',
        '[data-category-badge]',
        '[data-clear-categories]',
        '[data-availability-badge]',
        '[data-mobile-filter-badge]',
        '[data-clear-filters-mobile]',
        '[data-clear-filters]',
      ]) {
        expect($(selector).style.display, selector).toBe('none');
      }
      expect($('[data-brand-badge]').textContent).toBe('');
      expect($('[data-mobile-filter-badge]').textContent).toBe('');
    });

    it('treats a missing onSale as false', async () => {
      await freshInit();
      checkbox('onSale').checked = true;

      emitFilterChange({ brands: [], categories: [], availability: false });

      expect(checkbox('onSale').checked).toBe(false);
      expect($('[data-clear-filters]').style.display).toBe('none');
    });
  });

  describe('filterresult: the product count', () => {
    it('shows "N products" when nothing is filtered out, and hides Clear all', async () => {
      await freshInit();

      window.dispatchEvent(
        new CustomEvent('filterresult', { detail: { count: 12, total: 12 } })
      );

      expect($$('[data-result-count]').map((e) => e.textContent)).toEqual([
        '12 products',
        '12 products',
      ]);
      expect($('[data-clear-filters]').style.display).toBe('none');
    });

    it('shows "X of N products" when filtered, and reveals Clear all', async () => {
      await freshInit();

      window.dispatchEvent(
        new CustomEvent('filterresult', { detail: { count: 3, total: 12 } })
      );

      expect($$('[data-result-count]').map((e) => e.textContent)).toEqual([
        '3 of 12 products',
        '3 of 12 products',
      ]);
      expect($('[data-clear-filters]').style.display).toBe('');
    });

    it('announces the result through the live region after a short delay', async () => {
      vi.useFakeTimers();
      await freshInit();

      window.dispatchEvent(
        new CustomEvent('filterresult', { detail: { count: 3, total: 12 } })
      );
      expect($('#filter-results-live-region').textContent).toBe('');
      vi.advanceTimersByTime(100);
      expect($('#filter-results-live-region').textContent).toBe(
        'Filtered to 3 of 12 products'
      );

      window.dispatchEvent(
        new CustomEvent('filterresult', { detail: { count: 12, total: 12 } })
      );
      vi.advanceTimersByTime(100);
      expect($('#filter-results-live-region').textContent).toBe(
        'Showing all 12 products'
      );
    });
  });

  describe('page-load: the instance', () => {
    it('makes the product grid visible and clears the filtering flag', async () => {
      document.body.classList.add('filtering-in-progress');
      await freshInit();

      pageLoad();

      const grid = $('#filterable-product-grid');
      expect(grid.style.visibility).toBe('visible');
      expect(grid.style.opacity).toBe('1');
      expect(document.body.classList.contains('filtering-in-progress')).toBe(
        false
      );
    });

    it('does nothing for a page with no filter form (and still reveals the grid)', async () => {
      $('#filter-form').remove();
      await freshInit();

      expect(() => pageLoad()).not.toThrow();
      expect($('#filterable-product-grid').style.visibility).toBe('visible');
    });

    it('parks the drawer off-screen for the viewport: bottom on a phone, right on a tablet, neither on desktop', async () => {
      const container = () => $('#filter-container');
      await freshInit();

      setViewport(500);
      pageLoad();
      expect(container().classList.contains('translate-y-full')).toBe(true);
      expect(container().classList.contains('translate-x-full')).toBe(false);

      setViewport(900);
      pageLoad();
      expect(container().classList.contains('translate-x-full')).toBe(true);
      expect(container().classList.contains('translate-y-full')).toBe(false);

      setViewport(1280);
      pageLoad();
      expect(container().classList.contains('translate-x-full')).toBe(false);
      expect(container().classList.contains('translate-y-full')).toBe(false);
    });

    it('a second page-load destroys the previous instance instead of stacking listeners', async () => {
      await freshInit();
      pageLoad();
      pageLoad();
      const changes = filterChanges();

      tick(checkbox('brands', 'Baker'), true);

      expect(changes).toHaveLength(1);
    });
  });

  describe('the mobile drawer', () => {
    async function setupPhone() {
      setViewport(500);
      await freshInit();
      pageLoad();
    }

    it('opens from the toggle: lowers the header, reveals panel and overlay, locks scroll', async () => {
      await setupPhone();

      $('#mobile-filter-toggle').click();

      expect($('#site-header').style.zIndex).toBe('9');
      const overlay = $('#mobile-filter-overlay');
      expect(overlay.classList.contains('opacity-0')).toBe(false);
      expect(overlay.classList.contains('pointer-events-none')).toBe(false);
      const panel = $('#filter-container');
      expect(panel.classList.contains('translate-y-full')).toBe(false);
      expect(panel.classList.contains('opacity-0')).toBe(false);
      expect(panel.classList.contains('pointer-events-none')).toBe(false);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('opens a tablet panel from the right instead of the bottom', async () => {
      setViewport(900);
      await freshInit();
      pageLoad();

      $('#mobile-filter-toggle').click();

      expect(
        $('#filter-container').classList.contains('translate-x-full')
      ).toBe(false);
    });

    it.each([
      ['the close button', '#mobile-filter-close'],
      ['the overlay', '#mobile-filter-overlay'],
    ])(
      'closes from %s and restores the header after the transition',
      async (_name, selector) => {
        vi.useFakeTimers();
        await setupPhone();
        $('#mobile-filter-toggle').click();

        $(selector).click();

        expect(
          $('#filter-container').classList.contains('translate-y-full')
        ).toBe(true);
        expect($('#filter-container').classList.contains('opacity-0')).toBe(
          true
        );
        expect(
          $('#mobile-filter-overlay').classList.contains('opacity-0')
        ).toBe(true);
        expect(document.body.style.overflow).toBe('');
        // Until the transition ends (or the 350 ms fallback fires) the header
        // stays lowered and the panel can still be touched.
        expect($('#site-header').style.zIndex).toBe('9');

        vi.advanceTimersByTime(350);

        expect($('#site-header').style.zIndex).toBe('');
        expect(
          $('#filter-container').classList.contains('pointer-events-none')
        ).toBe(true);
        expect(
          $('#mobile-filter-overlay').classList.contains('pointer-events-none')
        ).toBe(true);
      }
    );

    it('closes on transitionend as well, and only completes once', async () => {
      vi.useFakeTimers();
      await setupPhone();
      $('#mobile-filter-toggle').click();
      $('#mobile-filter-close').click();

      $('#filter-container').dispatchEvent(new Event('transitionend'));
      expect($('#site-header').style.zIndex).toBe('');

      // The 350 ms fallback must not run the completion a second time: reopen
      // and confirm the late timer does not touch the header.
      $('#mobile-filter-toggle').click();
      vi.advanceTimersByTime(350);
      expect($('#site-header').style.zIndex).toBe('9');
    });

    it('re-parks a closed drawer when the viewport crosses the phone/tablet boundary', async () => {
      await setupPhone();
      expect(
        $('#filter-container').classList.contains('translate-y-full')
      ).toBe(true);

      setViewport(900);
      window.dispatchEvent(new Event('resize'));

      expect(
        $('#filter-container').classList.contains('translate-x-full')
      ).toBe(true);
      expect(
        $('#filter-container').classList.contains('translate-y-full')
      ).toBe(false);
    });

    it('leaves an open drawer alone on resize', async () => {
      await setupPhone();
      $('#mobile-filter-toggle').click();

      setViewport(900);
      window.dispatchEvent(new Event('resize'));

      expect(
        $('#filter-container').classList.contains('translate-x-full')
      ).toBe(false);
    });
  });

  describe('submitting filters', () => {
    it('on desktop, each checkbox change updates the URL and emits filterchange', async () => {
      await freshInit();
      pageLoad();
      const changes = filterChanges();

      tick(checkbox('brands', 'Baker'), true);
      tick(checkbox('categories', 'trucks'), true);
      tick(checkbox('availability'), true);
      tick(checkbox('onSale'), true);

      expect(window.location.pathname).toBe('/category/decks');
      expect(window.location.search).toBe(
        '?brands=Baker&categories=trucks&availability=true&onSale=true'
      );
      expect(changes.at(-1)).toEqual({
        brands: ['Baker'],
        categories: ['trucks'],
        availability: true,
        onSale: true,
      });
      expect(changes).toHaveLength(4);
    });

    it('drops the query string once every box is unticked', async () => {
      window.history.pushState({}, '', '/category/decks?brands=Baker');
      await freshInit();
      pageLoad();
      checkbox('brands', 'Baker').checked = true;

      tick(checkbox('brands', 'Baker'), false);

      expect(window.location.search).toBe('');
    });

    it('on a phone, a checkbox change does nothing until the form is submitted', async () => {
      vi.useFakeTimers();
      setViewport(500);
      await freshInit();
      pageLoad();
      const changes = filterChanges();

      tick(checkbox('brands', 'Baker'), true);
      expect(changes).toHaveLength(0);
      expect(window.location.search).toBe('');

      $('#mobile-filter-toggle').click();
      const submit = new Event('submit', { cancelable: true });
      $('#filter-form').dispatchEvent(submit);

      expect(submit.defaultPrevented).toBe(true);
      // The drawer closes first and the filter applies 300 ms later.
      expect(document.body.style.overflow).toBe('');
      expect(changes).toHaveLength(0);
      vi.advanceTimersByTime(300);
      expect(changes).toHaveLength(1);
      expect(window.location.search).toBe('?brands=Baker');
    });

    it('on desktop, submitting the form applies it immediately', async () => {
      await freshInit();
      pageLoad();
      checkbox('brands', 'Spitfire').checked = true;
      const changes = filterChanges();

      const submit = new Event('submit', { cancelable: true });
      $('#filter-form').dispatchEvent(submit);

      expect(submit.defaultPrevented).toBe(true);
      expect(changes).toHaveLength(1);
      expect(window.location.search).toBe('?brands=Spitfire');
    });
  });

  describe('clearing', () => {
    it('Clear all resets the URL to the bare path and emits an empty filterchange', async () => {
      window.history.pushState(
        {},
        '',
        '/category/decks?brands=Baker&onSale=true'
      );
      await freshInit();
      pageLoad();
      const changes = filterChanges();

      $('[data-clear-filters]').click();

      expect(window.location.search).toBe('');
      expect(changes).toEqual([
        { brands: [], categories: [], availability: false, onSale: false },
      ]);
    });

    it('the brand and category clear buttons uncheck their group and apply on desktop', async () => {
      await freshInit();
      pageLoad();
      checkbox('brands', 'Baker').checked = true;
      checkbox('brands', 'Spitfire').checked = true;
      checkbox('categories', 'trucks').checked = true;

      $('[data-clear-brands]').click();

      expect(checkbox('brands', 'Baker').checked).toBe(false);
      expect(checkbox('brands', 'Spitfire').checked).toBe(false);
      // Categories are untouched, and the URL reflects what is still ticked.
      expect(checkbox('categories', 'trucks').checked).toBe(true);
      expect(window.location.search).toBe('?categories=trucks');

      $('[data-clear-categories]').click();
      expect(checkbox('categories', 'trucks').checked).toBe(false);
      expect(window.location.search).toBe('');
    });

    it('on a phone, the brand clear button only unticks; it waits for Apply', async () => {
      setViewport(500);
      await freshInit();
      pageLoad();
      checkbox('brands', 'Baker').checked = true;
      const changes = filterChanges();

      $('[data-clear-brands]').click();

      expect(checkbox('brands', 'Baker').checked).toBe(false);
      expect(changes).toHaveLength(0);
    });

    it('the mobile Clear Filters button closes the drawer, then clears 100 ms later', async () => {
      vi.useFakeTimers();
      window.history.pushState({}, '', '/category/decks?brands=Baker');
      setViewport(500);
      await freshInit();
      pageLoad();
      $('#mobile-filter-toggle').click();
      const changes = filterChanges();

      $('[data-clear-filters-mobile]').click();

      expect(document.body.style.overflow).toBe('');
      expect(changes).toHaveLength(0);
      vi.advanceTimersByTime(100);
      expect(changes).toHaveLength(1);
      expect(window.location.search).toBe('');
    });
  });

  describe('accordions', () => {
    const content = (id: string) => document.getElementById(id) as HTMLElement;

    it('toggles a section, updates aria-expanded and the chevron, and remembers the state', async () => {
      await freshInit();
      pageLoad();
      const toggle = $('[data-section-toggle="brand"]');

      toggle.click();
      expect(content('brand-content').classList.contains('is-closed')).toBe(
        true
      );
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(
        toggle
          .closest('.filter-section')!
          .querySelector('.filter-chevron')!
          .classList.contains('is-collapsed')
      ).toBe(true);
      expect(sessionStorage.getItem('filter-section-brand')).toBe('closed');
      // The other section is independent.
      expect(sessionStorage.getItem('filter-section-category')).toBeNull();

      toggle.click();
      expect(content('brand-content').classList.contains('is-closed')).toBe(
        false
      );
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(sessionStorage.getItem('filter-section-brand')).toBe('open');
    });

    it('restores a saved closed state without animating, then re-enables the transition', async () => {
      vi.useFakeTimers();
      sessionStorage.setItem('filter-section-category', 'closed');
      await freshInit();
      pageLoad();

      const el = content('category-content');
      expect(el.classList.contains('is-closed')).toBe(true);
      expect(
        $('[data-section-toggle="category"]').getAttribute('aria-expanded')
      ).toBe('false');
      // Suppressed while the state is restored, so it does not animate on load.
      expect(el.style.transition).toBe('none');

      vi.advanceTimersByTime(100);
      expect(el.style.transition).toBe('');
      // The brand section had no saved state and stays open.
      expect(content('brand-content').classList.contains('is-closed')).toBe(
        false
      );
    });
  });

  describe('lifecycle', () => {
    it('astro:before-preparation hides an open drawer for the viewport and unlocks scroll', async () => {
      setViewport(500);
      await freshInit();
      pageLoad();
      $('#mobile-filter-toggle').click();
      expect(document.body.style.overflow).toBe('hidden');

      document.dispatchEvent(new Event('astro:before-preparation'));

      const panel = $('#filter-container');
      expect(panel.classList.contains('translate-y-full')).toBe(true);
      expect(panel.classList.contains('opacity-0')).toBe(true);
      expect(panel.classList.contains('pointer-events-none')).toBe(true);
      expect($('#mobile-filter-overlay').classList.contains('opacity-0')).toBe(
        true
      );
      expect(document.body.style.overflow).toBe('');
    });

    it('uses the side panel classes on a tablet and no drawer transform on desktop', async () => {
      setViewport(900);
      await freshInit();
      pageLoad();
      $('#filter-container').className = '';
      document.dispatchEvent(new Event('astro:before-preparation'));
      expect(
        $('#filter-container').classList.contains('translate-x-full')
      ).toBe(true);

      setViewport(1280);
      $('#filter-container').className = '';
      document.dispatchEvent(new Event('astro:before-preparation'));
      expect($('#filter-container').className).toBe('');
    });

    it('astro:before-preparation destroys the instance and resets the coordinator', async () => {
      await freshInit();
      pageLoad();
      const changes = filterChanges();

      document.dispatchEvent(new Event('astro:before-preparation'));

      expect(resetCoordinator).toHaveBeenCalledTimes(1);
      // The instance's listeners were aborted, so a change no longer submits.
      tick(checkbox('brands', 'Baker'), true);
      expect(changes).toHaveLength(0);
    });

    it('destroying an instance restores scroll and the header z-index', async () => {
      setViewport(500);
      await freshInit();
      pageLoad();
      $('#mobile-filter-toggle').click();
      expect($('#site-header').style.zIndex).toBe('9');

      pageLoad();

      expect(document.body.style.overflow).toBe('');
      expect($('#site-header').style.zIndex).toBe('');
    });

    it('astro:after-swap hides incoming product cards that are not already shown', async () => {
      await freshInit();

      document.dispatchEvent(new Event('astro:after-swap'));

      expect($('#card-a').classList.contains('opacity-0')).toBe(true);
      expect($('#card-b').classList.contains('opacity-0')).toBe(false);
    });
  });
});
