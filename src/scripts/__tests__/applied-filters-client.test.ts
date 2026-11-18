/**
 * Characterization tests for applied-filters-client (plan 226, extracted from
 * the inline script in AppliedFilters.astro). Each test does a fresh
 * `vi.resetModules()` + dynamic import because the module holds module-level
 * state (the `initialized` guard and the pending focus/announcement fields).
 *
 * The module registers listeners on `window` and `document` that outlive a
 * test, so every `addEventListener` call on them is recorded in `beforeEach`
 * and undone in `afterEach`; otherwise an earlier test's copy of the module
 * would also react to the events a later test dispatches.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { initializeCoordinator } = vi.hoisted(() => ({
  initializeCoordinator: vi.fn(),
}));

vi.mock('@/lib/filterCoordinator', () => ({
  FilterCoordinator: { initialize: initializeCoordinator },
}));

type Recorded = {
  target: Window | Document;
  type: string;
  listener: EventListenerOrEventListenerObject;
};
let recorded: Recorded[] = [];

const CATEGORY_NAMES = { trucks: 'Trucks', 'bearings-bolts-more': 'Bearings' };

function chip(attrs: string, label: string): string {
  return `<span><span>${label}</span><button type="button" ${attrs} aria-label="Remove ${label} filter"></button></span>`;
}

/** Server-rendered markup, as AppliedFilters.astro emits it. */
function setupDom(chipsHtml = ''): void {
  document.body.innerHTML = `
    <h1>Decks</h1>
    <div id="applied-filters-container" tabindex="-1"
      data-category-names='${JSON.stringify(CATEGORY_NAMES)}'>
      <div id="applied-filters-row">${chipsHtml}</div>
      <div id="applied-filters-live-region" aria-live="polite" class="sr-only"></div>
    </div>
  `;
}

function setUrl(query: string): void {
  window.history.pushState({}, '', `/category/decks${query}`);
}

async function freshInit() {
  vi.resetModules();
  const mod = await import('../applied-filters-client');
  mod.init();
  return mod;
}

function emitFilterChange(detail: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent('filterchange', { detail }));
}

const wait = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));
const row = () => document.getElementById('applied-filters-row') as HTMLElement;
const container = () =>
  document.getElementById('applied-filters-container') as HTMLElement;
const region = () =>
  document.getElementById('applied-filters-live-region') as HTMLElement;
const pills = () => [...row().querySelectorAll(':scope > span')];
const pillLabels = () =>
  pills().map((p) => p.querySelector('span')!.textContent);
const removeButtons = () => [
  ...row().querySelectorAll<HTMLButtonElement>(
    "[data-remove-brand], [data-filter-type='categories'], [data-remove-availability], [data-remove-on-sale]"
  ),
];

describe('applied-filters-client', () => {
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
    setupDom();
    setUrl('');
  });

  afterEach(() => {
    for (const { target, type, listener } of recorded) {
      target.removeEventListener(type, listener);
    }
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('init', () => {
    it('initializes the FilterCoordinator once', async () => {
      await freshInit();
      expect(initializeCoordinator).toHaveBeenCalledTimes(1);
    });

    it('is guarded: a second init() registers no second filterchange listener', async () => {
      const mod = await freshInit();
      const before = recorded.filter((r) => r.type === 'filterchange').length;
      mod.init();

      expect(recorded.filter((r) => r.type === 'filterchange')).toHaveLength(
        before
      );
      expect(before).toBe(1);
      expect(initializeCoordinator).toHaveBeenCalledTimes(1);
    });
  });

  describe('rendering on filterchange', () => {
    it('renders a pill per brand, a pill per category by display name, then Clear All', async () => {
      await freshInit();
      emitFilterChange({
        brands: ['Baker', 'Spitfire'],
        categories: ['trucks', 'unknown-slug'],
        availability: false,
        onSale: false,
      });

      expect(pillLabels()).toEqual([
        'Baker',
        'Spitfire',
        'Trucks',
        // A slug with no known name falls back to the raw slug.
        'unknown-slug',
      ]);
      expect(removeButtons()[0].getAttribute('aria-label')).toBe(
        'Remove Baker filter'
      );
      expect(removeButtons()[2].getAttribute('aria-label')).toBe(
        'Remove Trucks filter'
      );
      expect(removeButtons()[2].dataset.filterValue).toBe('trucks');
      expect(
        row().lastElementChild!.hasAttribute('data-clear-all-filters')
      ).toBe(true);
      expect(row().lastElementChild!.textContent).toBe('Clear All');
      expect(container().classList.contains('no-filters')).toBe(false);
    });

    it('renders the in-stock and on-sale pills', async () => {
      await freshInit();
      emitFilterChange({
        brands: [],
        categories: [],
        availability: true,
        onSale: true,
      });

      expect(pillLabels()).toEqual(['In stock only', 'On sale only']);
      expect(row().querySelector('[data-remove-availability]')).not.toBeNull();
      expect(row().querySelector('[data-remove-on-sale]')).not.toBeNull();
    });

    it('treats a missing onSale as false', async () => {
      await freshInit();
      emitFilterChange({
        brands: ['Baker'],
        categories: [],
        availability: false,
      });

      expect(pillLabels()).toEqual(['Baker']);
    });

    it('renders a brand name as text, never as markup', async () => {
      await freshInit();
      emitFilterChange({
        brands: ['<img src=x onerror=alert(1)>'],
        categories: [],
        availability: false,
      });

      expect(row().querySelector('img')).toBeNull();
      expect(pillLabels()).toEqual(['<img src=x onerror=alert(1)>']);
    });

    it('hides the container and empties the row when no filters remain', async () => {
      setupDom(chip('data-remove-brand="Baker"', 'Baker'));
      await freshInit();
      emitFilterChange({
        brands: [],
        categories: [],
        availability: false,
        onSale: false,
      });

      expect(container().classList.contains('no-filters')).toBe(true);
      expect(row().innerHTML).toBe('');
    });
  });

  describe('removing filters', () => {
    it('removes one brand: updates the URL, emits filterchange, re-renders the rest', async () => {
      setUrl(
        '?brands=Baker&brands=Spitfire&categories=trucks&availability=true'
      );
      await freshInit();
      emitFilterChange({
        brands: ['Baker', 'Spitfire'],
        categories: ['trucks'],
        availability: true,
        onSale: false,
      });
      const seen: unknown[] = [];
      window.addEventListener('filterchange', (e) =>
        seen.push((e as CustomEvent).detail)
      );

      removeButtons()[0].click();

      expect(window.location.search).toBe(
        '?brands=Spitfire&categories=trucks&availability=true'
      );
      expect(seen).toEqual([
        {
          brands: ['Spitfire'],
          categories: ['trucks'],
          availability: true,
          onSale: false,
        },
      ]);
      expect(pillLabels()).toEqual(['Spitfire', 'Trucks', 'In stock only']);
    });

    it('removes a category by its slug, keeping the other filters', async () => {
      setUrl('?brands=Baker&categories=trucks&categories=bearings-bolts-more');
      await freshInit();
      emitFilterChange({
        brands: ['Baker'],
        categories: ['trucks', 'bearings-bolts-more'],
        availability: false,
        onSale: false,
      });

      removeButtons()
        .find((b) => b.dataset.filterValue === 'trucks')!
        .click();

      expect(window.location.search).toBe(
        '?brands=Baker&categories=bearings-bolts-more'
      );
    });

    it('removes in-stock and on-sale independently', async () => {
      setUrl('?availability=true&onSale=true');
      await freshInit();
      emitFilterChange({
        brands: [],
        categories: [],
        availability: true,
        onSale: true,
      });

      row().querySelector<HTMLElement>('[data-remove-availability]')!.click();
      expect(window.location.search).toBe('?onSale=true');

      row().querySelector<HTMLElement>('[data-remove-on-sale]')!.click();
      expect(window.location.search).toBe('');
    });

    it('Clear All empties every filter and drops the query string', async () => {
      setUrl('?brands=Baker&categories=trucks&availability=true&onSale=true');
      await freshInit();
      emitFilterChange({
        brands: ['Baker'],
        categories: ['trucks'],
        availability: true,
        onSale: true,
      });

      row().querySelector<HTMLElement>('[data-clear-all-filters]')!.click();

      expect(window.location.pathname).toBe('/category/decks');
      expect(window.location.search).toBe('');
      expect(container().classList.contains('no-filters')).toBe(true);
    });
  });

  describe('focus and announcements', () => {
    it('moves focus to the chip that takes the removed one place', async () => {
      setUrl('?brands=Baker&brands=Spitfire');
      await freshInit();
      emitFilterChange({
        brands: ['Baker', 'Spitfire'],
        categories: [],
        availability: false,
        onSale: false,
      });

      removeButtons()[0].click();

      expect(document.activeElement).toBe(removeButtons()[0]);
      expect(removeButtons()[0].dataset.removeBrand).toBe('Spitfire');
    });

    it('clamps focus to the last chip when the last one is removed', async () => {
      setUrl('?brands=Baker&brands=Spitfire');
      await freshInit();
      emitFilterChange({
        brands: ['Baker', 'Spitfire'],
        categories: [],
        availability: false,
        onSale: false,
      });

      removeButtons()[1].click();

      expect(document.activeElement).toBe(removeButtons()[0]);
      expect(removeButtons()[0].dataset.removeBrand).toBe('Baker');
    });

    it('moves focus to the page heading when the last filter is removed', async () => {
      setUrl('?brands=Baker');
      await freshInit();
      emitFilterChange({
        brands: ['Baker'],
        categories: [],
        availability: false,
        onSale: false,
      });

      removeButtons()[0].click();

      const h1 = document.querySelector('h1') as HTMLElement;
      expect(h1.getAttribute('tabindex')).toBe('-1');
      expect(document.activeElement).toBe(h1);
    });

    it('falls back to focusing the container when there is no heading', async () => {
      document.querySelector('h1')!.remove();
      setUrl('?brands=Baker');
      await freshInit();
      emitFilterChange({
        brands: ['Baker'],
        categories: [],
        availability: false,
        onSale: false,
      });

      removeButtons()[0].click();

      expect(document.activeElement).toBe(container());
    });

    it('announces which filter was removed through the live region', async () => {
      setUrl('?brands=Baker&brands=Spitfire');
      await freshInit();
      emitFilterChange({
        brands: ['Baker', 'Spitfire'],
        categories: [],
        availability: false,
        onSale: false,
      });

      // A previous announcement is still in the region: it must be cleared
      // first so a screen reader re-announces even identical text.
      region().textContent = 'Spitfire filter removed';

      removeButtons()[0].click();
      expect(region().textContent).toBe('');
      await wait();

      expect(region().textContent).toBe('Baker filter removed');
    });

    it('announces a category by its display name and Clear All as "All"', async () => {
      setUrl('?categories=trucks&brands=Baker');
      await freshInit();
      emitFilterChange({
        brands: ['Baker'],
        categories: ['trucks'],
        availability: false,
        onSale: false,
      });

      removeButtons()
        .find((b) => b.dataset.filterValue === 'trucks')!
        .click();
      await wait();
      expect(region().textContent).toBe('Trucks filter removed');

      row().querySelector<HTMLElement>('[data-clear-all-filters]')!.click();
      await wait();
      expect(region().textContent).toBe('All filter removed');
    });

    it('does not steal focus or announce for a change it did not cause', async () => {
      await freshInit();
      const outside = document.createElement('button');
      document.body.appendChild(outside);
      outside.focus();

      emitFilterChange({
        brands: ['Baker'],
        categories: [],
        availability: false,
        onSale: false,
      });
      await wait();

      expect(document.activeElement).toBe(outside);
      expect(region().textContent).toBe('');
    });
  });

  describe('lifecycle', () => {
    it('astro:page-load binds the server-rendered chips', async () => {
      setUrl('?brands=Baker&availability=true');
      setupDom(
        chip('data-remove-brand="Baker"', 'Baker') +
          chip('data-remove-availability', 'In stock only')
      );
      await freshInit();

      // Before the page-load event nothing is bound yet.
      row().querySelector<HTMLElement>('[data-remove-brand]')!.click();
      expect(window.location.search).toBe('?brands=Baker&availability=true');

      document.dispatchEvent(new Event('astro:page-load'));

      row().querySelector<HTMLElement>('[data-remove-brand]')!.click();
      expect(window.location.search).toBe('?availability=true');
    });

    it('astro:page-load rebinds against the DOM of the new page after a swap', async () => {
      setUrl('?brands=Spitfire');
      await freshInit();
      document.dispatchEvent(new Event('astro:page-load'));

      // A swap replaces the body; the new page arrives with its own chips.
      setupDom(chip('data-remove-brand="Spitfire"', 'Spitfire'));
      document.dispatchEvent(new Event('astro:page-load'));

      row().querySelector<HTMLElement>('[data-remove-brand]')!.click();
      expect(window.location.search).toBe('');
    });
  });
});
