/**
 * Tests for news-pagination-client (plan 226, extracted from the inline script
 * in NewsPaginationControls.astro; plan 233 replaced its hand-rolled
 * fetch-and-swap with the Astro router). Each test does a fresh
 * `vi.resetModules()` + dynamic import because the module holds module-level
 * state (the `initialized` guard).
 *
 * The module registers a listener on `document` that outlives a test, so every
 * `addEventListener` call on it is recorded in `beforeEach` and undone in
 * `afterEach`; otherwise an earlier test's copy of the module would also react
 * to the `astro:page-load` a later test dispatches.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('astro:transitions/client', () => ({ navigate }));

type Recorded = {
  target: Document;
  type: string;
  listener: EventListenerOrEventListenerObject;
};
let recorded: Recorded[] = [];

function setupDom(): void {
  document.body.innerHTML = `
    <main>
      <nav id="news-pagination-controls">
        <div class="text-sm text-(--content-meta)">Showing 1-12 of 30 articles</div>
        <a href="#" data-news-page="2"><span>2</span></a>
        <a href="#" data-news-page="3"><span>3</span></a>
      </nav>
    </main>`;
}

async function freshInit() {
  vi.resetModules();
  const mod = await import('../news-pagination-client');
  mod.init();
  return mod;
}

function pageLoad(): void {
  document.dispatchEvent(new Event('astro:page-load'));
}

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector(selector) as T;
const link = (page: number) => $(`[data-news-page="${page}"]`);

describe('news-pagination-client', () => {
  beforeEach(() => {
    recorded = [];
    const original = document.addEventListener.bind(document) as (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) => void;
    vi.spyOn(document, 'addEventListener').mockImplementation(
      (type: string, listener: unknown, options?: unknown) => {
        recorded.push({
          target: document,
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
    navigate.mockClear();
    window.history.pushState({}, '', '/news');
    setupDom();
  });

  afterEach(() => {
    for (const { target, type, listener } of recorded) {
      target.removeEventListener(type, listener);
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  describe('init', () => {
    it('registers a single astro:page-load handler', async () => {
      await freshInit();

      expect(recorded.map((r) => r.type)).toEqual(['astro:page-load']);
    });

    it('is guarded: a second init() registers nothing further', async () => {
      const mod = await freshInit();
      mod.init();

      expect(recorded).toHaveLength(1);
    });

    it('does nothing on a page without pagination controls', async () => {
      $('#news-pagination-controls').remove();
      await freshInit();

      expect(() => pageLoad()).not.toThrow();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('clicking a page link', () => {
    it('ignores clicks that are not on a page link', async () => {
      await freshInit();
      pageLoad();

      const click = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      $('#news-pagination-controls').dispatchEvent(click);

      expect(click.defaultPrevented).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('intercepts a page link, also when the click lands on a child, and navigates through the router', async () => {
      await freshInit();
      pageLoad();

      const click = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      link(2).querySelector('span')!.dispatchEvent(click);

      expect(click.defaultPrevented).toBe(true);
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith('/news?page=2');
    });

    it('does not fetch or rewrite the page itself: the router owns the swap', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      await freshInit();
      pageLoad();

      link(2).click();

      expect(fetchMock).not.toHaveBeenCalled();
      // The current DOM is untouched until the router swaps the page.
      expect($('main').innerHTML).toContain('Showing 1-12 of 30 articles');
      expect(document.querySelectorAll('[data-news-page]')).toHaveLength(2);
    });

    it('keeps the current filters and replaces the page param', async () => {
      window.history.pushState(
        {},
        '',
        '/news?categories=shop-news&tags=skate&page=2&utm_source=x'
      );
      await freshInit();
      pageLoad();

      link(3).click();

      // Only the news parameters survive (unrelated ones are dropped), in the
      // fixed order createNewsAwareURL emits them.
      expect(navigate).toHaveBeenCalledWith(
        '/news?page=3&categories=shop-news&tags=skate'
      );
    });

    it('keeps the view, search, sort and date range too', async () => {
      window.history.pushState(
        {},
        '',
        '/news?view=list&search=baker&sort=oldest&dateRange=month'
      );
      await freshInit();
      pageLoad();

      link(2).click();

      expect(navigate).toHaveBeenCalledWith(
        '/news?view=list&search=baker&sort=oldest&page=2&dateRange=month'
      );
    });

    it('going to page 1 drops the page param instead of setting page=1', async () => {
      window.history.pushState({}, '', '/news?tags=skate&page=3');
      $('#news-pagination-controls').innerHTML =
        '<a href="#" data-news-page="1">1</a>';
      await freshInit();
      pageLoad();

      link(1).click();

      expect(navigate).toHaveBeenCalledWith('/news?tags=skate');
    });

    it('treats a link with no page number as page 1', async () => {
      window.history.pushState({}, '', '/news?page=4');
      $('#news-pagination-controls').innerHTML =
        '<a href="#" data-news-page>first</a>';
      await freshInit();
      pageLoad();

      $('[data-news-page]').click();

      expect(navigate).toHaveBeenCalledWith('/news');
    });
  });

  describe('lifecycle', () => {
    it('a page-load after a swap binds the new controls, and each click navigates once', async () => {
      await freshInit();
      pageLoad();

      // The router swapped in a fresh page and fired astro:page-load.
      setupDom();
      pageLoad();
      link(2).click();

      expect(navigate).toHaveBeenCalledTimes(1);
    });
  });
});
