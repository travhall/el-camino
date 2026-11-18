/**
 * Characterization tests for news-pagination-client (plan 226, extracted from
 * the inline script in NewsPaginationControls.astro). Each test does a fresh
 * `vi.resetModules()` + dynamic import because the module holds module-level
 * state (the `initialized` guard).
 *
 * The module registers a listener on `document` that outlives a test, so every
 * `addEventListener` call on it is recorded in `beforeEach` and undone in
 * `afterEach`; otherwise an earlier test's copy of the module would also react
 * to the `astro:page-load` a later test dispatches.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type Recorded = {
  target: Document;
  type: string;
  listener: EventListenerOrEventListenerObject;
};
let recorded: Recorded[] = [];
let assigned: string[] = [];
const realLocation = window.location;

const SUMMARY = '.text-sm.text-\\(--content-meta\\)';

/** The news page: the summary line, the grid and the controls all sit in <main>. */
function pageHtml(opts: { summary: string; grid: string; links: number[] }) {
  return `
    <p class="text-sm text-(--content-meta)">${opts.summary}</p>
    <div id="grid">${opts.grid}</div>
    <nav id="news-pagination-controls">
      ${opts.links
        .map((n) => `<a href="#" data-news-page="${n}"><span>${n}</span></a>`)
        .join('')}
    </nav>`;
}

function setupDom(): void {
  document.body.innerHTML = `<main style="opacity: 1">${pageHtml({
    summary: 'Showing 1-12 of 30',
    grid: 'page one posts',
    links: [2, 3],
  })}</main>`;
}

function mockFetch(impl: (url: string) => Promise<Response> | Response) {
  const fn = vi.fn((url: string) => Promise.resolve(impl(url)));
  vi.stubGlobal('fetch', fn);
  return fn;
}

function htmlResponse(html: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: () => Promise.resolve(html),
  } as unknown as Response;
}

const nextPage = (n: number) =>
  `<html><body><main>${pageHtml({
    summary: `Showing ${n}`,
    grid: `page ${n} posts`,
    links: [1, 3],
  })}</main></body></html>`;

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
/** Click and let the async load, the 150 ms fade and the content swap finish. */
async function clickAndSettle(page: number) {
  link(page).click();
  await vi.advanceTimersByTimeAsync(400);
}

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
    vi.useFakeTimers();
    window.history.pushState({}, '', '/news');
    // Reads go through to the real location (so pushState keeps working);
    // assigning href, the fallback navigation, is recorded instead of followed.
    assigned = [];
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get pathname() {
          return realLocation.pathname;
        },
        get search() {
          return realLocation.search;
        },
        get href() {
          return realLocation.href;
        },
        set href(value: string) {
          assigned.push(value);
        },
      },
    });
    setupDom();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    for (const { target, type, listener } of recorded) {
      target.removeEventListener(type, listener);
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: realLocation,
    });
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
      const fetchMock = mockFetch(() => htmlResponse(nextPage(2)));
      await freshInit();

      expect(() => pageLoad()).not.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('clicking a page link', () => {
    it('ignores clicks that are not on a page link', async () => {
      const fetchMock = mockFetch(() => htmlResponse(nextPage(2)));
      await freshInit();
      pageLoad();

      const click = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      $('#news-pagination-controls').dispatchEvent(click);

      expect(click.defaultPrevented).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('intercepts a page link (also when the click lands on a child) and fetches that page as HTML', async () => {
      const fetchMock = mockFetch(() => htmlResponse(nextPage(2)));
      await freshInit();
      pageLoad();

      const click = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      link(2).querySelector('span')!.dispatchEvent(click);
      await vi.advanceTimersByTimeAsync(400);

      expect(click.defaultPrevented).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith('/news?page=2', {
        headers: {
          Accept: 'text/html',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
    });

    it('keeps the current filters and replaces the page param', async () => {
      window.history.pushState(
        {},
        '',
        '/news?categories=shop-news&tags=skate&page=2&utm_source=x'
      );
      const fetchMock = mockFetch(() => htmlResponse(nextPage(3)));
      await freshInit();
      pageLoad();

      await clickAndSettle(3);

      // Only the news parameters survive (unrelated ones are dropped), in the
      // fixed order createNewsAwareURL emits them.
      expect(fetchMock.mock.calls[0][0]).toBe(
        '/news?page=3&categories=shop-news&tags=skate'
      );
    });

    it('going to page 1 drops the page param instead of setting page=1', async () => {
      window.history.pushState({}, '', '/news?tags=skate&page=3');
      const fetchMock = mockFetch(() => htmlResponse(nextPage(1)));
      $('#news-pagination-controls').innerHTML =
        '<a href="#" data-news-page="1">1</a>';
      await freshInit();
      pageLoad();

      await clickAndSettle(1);

      expect(fetchMock.mock.calls[0][0]).toBe('/news?tags=skate');
    });

    it('treats a link with no page number as page 1', async () => {
      window.history.pushState({}, '', '/news?page=4');
      const fetchMock = mockFetch(() => htmlResponse(nextPage(1)));
      $('#news-pagination-controls').innerHTML =
        '<a href="#" data-news-page>first</a>';
      await freshInit();
      pageLoad();

      $('[data-news-page]').click();
      await vi.advanceTimersByTimeAsync(400);

      expect(fetchMock.mock.calls[0][0]).toBe('/news');
    });
  });

  describe('loading state', () => {
    it('dims and locks <main> and shows a loader while the request is pending, then restores them', async () => {
      let resolveFetch!: (r: Response) => void;
      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise<Response>((resolve) => {
              resolveFetch = resolve;
            })
        )
      );
      await freshInit();
      pageLoad();

      link(2).click();

      const main = $('main');
      expect(main.style.opacity).toBe('0.6');
      expect(main.style.pointerEvents).toBe('none');
      expect($('#pagination-loader').textContent).toContain('Loading...');

      resolveFetch(htmlResponse(nextPage(2)));
      await vi.advanceTimersByTimeAsync(400);

      expect(main.style.opacity).toBe('1');
      expect(main.style.pointerEvents).toBe('');
      expect(document.querySelector('#pagination-loader')).toBeNull();
    });
  });

  describe('a response that loads', () => {
    // KNOWN BUG (plan 226 notes, not fixed here: this change is a move).
    // updatePageContent() looks up the results summary with the selector
    // '.text-sm.text-(--content-meta)', which is not valid CSS, so every load
    // throws a SyntaxError after <main> and the controls have been swapped and
    // before history.pushState and the scroll. The catch then falls back to a
    // full navigation. These tests pin that behaviour; when the selector is
    // fixed they should be replaced by the it.todo cases below.
    it('swaps <main> and the controls, then throws on the summary selector and falls back to a full navigation', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockFetch(() => htmlResponse(nextPage(2)));
      await freshInit();
      pageLoad();
      const pushState = vi.spyOn(window.history, 'pushState');

      link(2).click();
      // The fade-out is still running: the old content is still there.
      await vi.advanceTimersByTimeAsync(100);
      expect($('#grid').textContent).toBe('page one posts');

      await vi.advanceTimersByTimeAsync(300);

      // Content was swapped before the failure...
      expect($('#grid').textContent).toBe('page 2 posts');
      expect(
        [...document.querySelectorAll('[data-news-page]')].map(
          (a) => (a as HTMLElement).dataset.newsPage
        )
      ).toEqual(['1', '3']);
      // ...the summary was not, and the load ended in the fallback.
      expect($(SUMMARY).textContent).toBe('Showing 2');
      expect(consoleError).toHaveBeenCalledWith(
        'News pagination error:',
        expect.objectContaining({ name: 'SyntaxError' })
      );
      expect(assigned).toEqual(['/news?page=2']);
      expect(pushState).not.toHaveBeenCalled();
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
      expect($('main').style.opacity).toBe('1');
      expect(document.querySelector('#pagination-loader')).toBeNull();
    });

    it('re-binds the swapped controls, so the new links work and fire once per click', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = mockFetch((url) =>
        htmlResponse(
          nextPage(Number(new URL(url, 'http://x').searchParams.get('page')))
        )
      );
      await freshInit();
      pageLoad();

      await clickAndSettle(2);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await clickAndSettle(3);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][0]).toBe('/news?page=3');
    });

    it.todo(
      'once the summary selector is fixed: updates the summary, pushes the URL and scrolls up, with no fallback navigation'
    );
  });

  describe('a failed load', () => {
    it('logs the error and falls back to a normal navigation to the same URL', async () => {
      window.history.pushState({}, '', '/news?tags=skate&page=2');
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockFetch(() => htmlResponse('', false, 500));
      await freshInit();
      pageLoad();

      link(3).click();
      await vi.advanceTimersByTimeAsync(400);

      expect(consoleError).toHaveBeenCalledWith(
        'News pagination error:',
        expect.objectContaining({ message: 'HTTP 500' })
      );
      expect(assigned).toEqual(['/news?page=3&tags=skate']);
      // The page was not swapped.
      expect($('#grid').textContent).toBe('page one posts');
    });

    it('the fallback for page 1 drops the page param, like the fetch URL does', async () => {
      window.history.pushState({}, '', '/news?tags=skate&page=3');
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch(() => htmlResponse('', false, 500));
      $('#news-pagination-controls').innerHTML =
        '<a href="#" data-news-page="1">1</a>';
      await freshInit();
      pageLoad();

      link(1).click();
      await vi.advanceTimersByTimeAsync(400);

      expect(assigned).toEqual(['/news?tags=skate']);
    });

    it('also falls back when the request itself rejects, and unlocks <main>', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('offline')))
      );
      await freshInit();
      pageLoad();

      link(3).click();
      await vi.advanceTimersByTimeAsync(400);

      expect(assigned).toEqual(['/news?page=3']);
      expect($('main').style.opacity).toBe('1');
      expect($('main').style.pointerEvents).toBe('');
      expect(document.querySelector('#pagination-loader')).toBeNull();
    });

    it('the error message in the loader is removed immediately, so it is never seen', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch(() => htmlResponse('', false, 503));
      await freshInit();
      pageLoad();

      link(2).click();
      await vi.advanceTimersByTimeAsync(0);

      // showErrorState() writes "Failed to load page. Redirecting..." into the
      // loader, but hideLoadingState() runs in the same tick and removes it.
      expect(document.querySelector('#pagination-loader')).toBeNull();
      expect(document.body.textContent).not.toContain('Failed to load page');
    });
  });

  describe('lifecycle', () => {
    it('a page-load after a swap binds the new controls', async () => {
      const fetchMock = mockFetch(() => htmlResponse(nextPage(2)));
      await freshInit();
      pageLoad();

      // A swap replaces the body with a fresh page.
      setupDom();
      pageLoad();
      await clickAndSettle(2);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
