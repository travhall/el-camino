/**
 * Characterization tests for article-grid-client (plan 226, extracted from the
 * hoisted script in ArticleGrid.astro; the small `is:inline` script that arms
 * the first cards stays inline and is covered by newsEntranceInline.test.ts).
 *
 * The module reads `prefers-reduced-motion` and the animation timing CSS
 * variables when it is first loaded, so each test sets those up and then does a
 * fresh `vi.resetModules()` + dynamic import. It also registers listeners on
 * `window` and `document` that outlive a test, so every `addEventListener` call
 * on them is recorded in `beforeEach` and undone in `afterEach`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { armCardsOnImageReady } = vi.hoisted(() => ({
  armCardsOnImageReady: vi.fn(),
}));

vi.mock('@/lib/ui/cardEntrance', () => ({ armCardsOnImageReady }));

type Recorded = {
  target: Window | Document;
  type: string;
  listener: EventListenerOrEventListenerObject;
};
let recorded: Recorded[] = [];

type IOEntry = { isIntersecting: boolean; target: Element };

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observed: Element[] = [];
  unobserved: Element[] = [];
  constructor(
    public callback: (entries: IOEntry[], observer: unknown) => void,
    public options: IntersectionObserverInit
  ) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(element: Element) {
    this.observed.push(element);
  }
  unobserve(element: Element) {
    this.unobserved.push(element);
  }
  disconnect() {}
  trigger(entries: IOEntry[]) {
    this.callback(entries, this);
  }
}

const DEFAULT_VARS: Record<string, string> = {
  '--card-transition-duration': '300ms',
  '--card-stagger-delay': '50ms',
  '--grid-entrance-delay': '0ms',
};
let cssVars: Record<string, string> = {};
let reducedMotion = false;

function setViewport(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
    writable: true,
  });
}

function card(opts: {
  id: string;
  variant?: string;
  index?: number | null;
  classes?: string;
}): string {
  const index =
    opts.index === null ? '' : ` data-initial-index="${opts.index ?? 0}"`;
  return `<div id="${opts.id}" class="article-card-wrapper ${opts.classes ?? 'opacity-0'}" data-variant="${opts.variant ?? 'grid'}"${index}></div>`;
}

function setupDom(html: string): void {
  document.body.innerHTML = html;
}

async function freshInit() {
  vi.resetModules();
  const mod = await import('../article-grid-client');
  mod.init();
  return mod;
}

function pageLoad(): void {
  document.dispatchEvent(new Event('astro:page-load'));
}

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector(selector) as T;
const instances = () => FakeIntersectionObserver.instances;
/** The observer that animates the cards (the lazy-image one has a 100px margin). */
const cardObserver = () =>
  instances().find((i) => i.options.rootMargin === '200px')!;
const lazyObserver = () =>
  instances().find((i) => i.options.rootMargin === '100px')!;
const intersect = (el: Element) =>
  cardObserver().trigger([{ isIntersecting: true, target: el }]);

describe('article-grid-client', () => {
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
    armCardsOnImageReady.mockClear();
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    (window as unknown as Record<string, unknown>).IntersectionObserver =
      FakeIntersectionObserver;
    cssVars = { ...DEFAULT_VARS };
    reducedMotion = false;
    window.matchMedia = ((query: string) => ({
      matches: reducedMotion && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () =>
        ({
          getPropertyValue: (name: string) => cssVars[name] ?? '',
        }) as CSSStyleDeclaration
    );
    setViewport(1280);
    setupDom('');
  });

  afterEach(() => {
    for (const { target, type, listener } of recorded) {
      target.removeEventListener(type, listener);
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (window as unknown as Record<string, unknown>).IntersectionObserver;
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('init', () => {
    it('registers page-load, articleGridReady and pageshow, in that order', async () => {
      await freshInit();

      expect(recorded.map((r) => r.type)).toEqual([
        'astro:page-load',
        'articleGridReady',
        'pageshow',
      ]);
    });

    it('is guarded: a second init() registers nothing further', async () => {
      const mod = await freshInit();
      mod.init();

      expect(recorded).toHaveLength(3);
    });
  });

  describe('page-load: the page', () => {
    it('makes the filterable grid visible', async () => {
      setupDom('<div id="filterable-article-grid" style="opacity: 0"></div>');
      await freshInit();

      pageLoad();

      expect($('#filterable-article-grid').style.opacity).toBe('1');
    });

    it('arms the masonry cards on image ready, with a 1200 ms bound, on every page-load', async () => {
      await freshInit();

      pageLoad();
      pageLoad();

      expect(armCardsOnImageReady).toHaveBeenCalledTimes(2);
      expect(armCardsOnImageReady).toHaveBeenCalledWith(document, 1200);
    });

    it('does nothing for a page with no cards', async () => {
      await freshInit();

      expect(() => pageLoad()).not.toThrow();
      expect(instances()).toHaveLength(0);
    });
  });

  describe('page-load: entrance animations', () => {
    it('with reduced motion, shows the cards at once and observes nothing', async () => {
      reducedMotion = true;
      setupDom(
        card({ id: 'a' }) +
          card({ id: 'b', classes: 'card-entrance-ready' }) +
          card({ id: 'c', classes: 'opacity-100' })
      );
      await freshInit();

      pageLoad();

      for (const id of ['#a', '#b']) {
        expect($(id).classList.contains('opacity-0')).toBe(false);
        expect($(id).classList.contains('opacity-100')).toBe(true);
      }
      expect(instances()).toHaveLength(0);
    });

    it('leaves the masonry entrance to CSS: no observer', async () => {
      setupDom(card({ id: 'a', variant: 'masonry' }));
      await freshInit();

      pageLoad();

      expect(instances()).toHaveLength(0);
      expect($('#a').classList.contains('opacity-0')).toBe(true);
    });

    it('takes the view from the first card that is not a sidebar card', async () => {
      setupDom(
        card({ id: 'side', variant: 'sidebar' }) +
          card({ id: 'a', variant: 'list', index: 4 })
      );
      await freshInit();

      pageLoad();
      intersect($('#a'));

      // List view: index * 1.5, whatever the viewport.
      expect($('#a').style.getPropertyValue('--animation-order')).toBe('6');
    });

    it('observes every hidden or entrance-ready card, and not an already visible one', async () => {
      setupDom(
        card({ id: 'a' }) +
          card({ id: 'b', classes: 'card-entrance-ready' }) +
          card({ id: 'c', classes: 'opacity-100' })
      );
      await freshInit();

      pageLoad();

      expect(cardObserver().options).toEqual({
        threshold: 0.1,
        rootMargin: '200px',
      });
      expect(cardObserver().observed.map((e) => e.id)).toEqual(['a', 'b']);
    });

    it.each([
      [1600, '4.8'], // 6 per row: row 0, column 4
      [1280, '3'], // 4 per row: row 1, column 0
      [800, '4.2'], // 3 per row: row 1, column 1
      [500, '6'], // 2 per row: row 2, column 0
      [300, '12'], // 1 per row: row 4, column 0
    ])(
      'grid view staggers by row and column at %ipx wide (index 4 -> %s)',
      async (width, expected) => {
        setViewport(width);
        setupDom(card({ id: 'a', variant: 'grid', index: 4 }));
        await freshInit();

        pageLoad();
        intersect($('#a'));

        expect($('#a').style.getPropertyValue('--animation-order')).toBe(
          expected
        );
      }
    );

    it('staggers a list card by index, and a sidebar card after the articles', async () => {
      setupDom(
        card({ id: 'a', variant: 'list', index: 2 }) +
          card({ id: 'side', variant: 'sidebar', index: 1 })
      );
      await freshInit();

      pageLoad();
      intersect($('#a'));
      intersect($('#side'));

      expect($('#a').style.getPropertyValue('--animation-order')).toBe('3');
      expect($('#side').style.getPropertyValue('--animation-order')).toBe('9');
    });

    it('a card without an index counts as the first', async () => {
      setupDom(card({ id: 'a', variant: 'list', index: null }));
      await freshInit();

      pageLoad();
      intersect($('#a'));

      expect($('#a').style.getPropertyValue('--animation-order')).toBe('0');
    });

    it('reveals a card when it enters the viewport, then stops watching it', async () => {
      vi.useFakeTimers();
      setupDom(card({ id: 'a', variant: 'list', index: 4 }));
      await freshInit();
      pageLoad();

      intersect($('#a'));

      expect($('#a').classList.contains('opacity-0')).toBe(false);
      expect($('#a').classList.contains('opacity-100')).toBe(true);
      expect($('#a').classList.contains('animating')).toBe(true);
      expect(cardObserver().unobserved.map((e) => e.id)).toEqual(['a']);

      // will-change is dropped once the animation is over: duration 300 ms
      // plus order 6 x stagger 50 ms.
      vi.advanceTimersByTime(599);
      expect($('#a').classList.contains('animating')).toBe(true);
      vi.advanceTimersByTime(1);
      expect($('#a').classList.contains('animating')).toBe(false);
    });

    it('ignores an entry that is not intersecting', async () => {
      setupDom(card({ id: 'a' }));
      await freshInit();
      pageLoad();

      cardObserver().trigger([{ isIntersecting: false, target: $('#a') }]);

      expect($('#a').classList.contains('opacity-0')).toBe(true);
      expect(cardObserver().unobserved).toHaveLength(0);
    });

    it('reads the timing from CSS: seconds or milliseconds, with defaults', async () => {
      vi.useFakeTimers();
      cssVars['--card-transition-duration'] = '0.5s';
      cssVars['--card-stagger-delay'] = '100ms';
      setupDom(card({ id: 'a', variant: 'list', index: 2 })); // order 3
      await freshInit();
      pageLoad();

      intersect($('#a'));

      // 500 ms + 3 x 100 ms
      vi.advanceTimersByTime(799);
      expect($('#a').classList.contains('animating')).toBe(true);
      vi.advanceTimersByTime(1);
      expect($('#a').classList.contains('animating')).toBe(false);
    });

    it('falls back to 300 ms and no stagger when the CSS variables are missing', async () => {
      vi.useFakeTimers();
      cssVars = {};
      setupDom(card({ id: 'a', variant: 'list', index: 2 }));
      await freshInit();
      pageLoad();

      intersect($('#a'));

      vi.advanceTimersByTime(299);
      expect($('#a').classList.contains('animating')).toBe(true);
      vi.advanceTimersByTime(1);
      expect($('#a').classList.contains('animating')).toBe(false);
    });

    it('on the news page, waits for the entrance delay before animating', async () => {
      vi.useFakeTimers();
      cssVars['--grid-entrance-delay'] = '250ms';
      setupDom('<div id="filterable-article-grid"></div>' + card({ id: 'a' }));
      await freshInit();

      pageLoad();
      expect(instances()).toHaveLength(0);
      vi.advanceTimersByTime(249);
      expect(instances()).toHaveLength(0);
      vi.advanceTimersByTime(1);

      expect(cardObserver().observed.map((e) => e.id)).toEqual(['a']);
    });

    it('on the home page, the entrance delay does not apply', async () => {
      cssVars['--grid-entrance-delay'] = '250ms';
      setupDom(card({ id: 'a' }));
      await freshInit();

      pageLoad();

      expect(cardObserver().observed.map((e) => e.id)).toEqual(['a']);
    });

    it('on the news page with no delay configured, animates straight away', async () => {
      setupDom('<div id="filterable-article-grid"></div>' + card({ id: 'a' }));
      await freshInit();

      pageLoad();

      expect(cardObserver().observed.map((e) => e.id)).toEqual(['a']);
    });
  });

  describe('page-load: lazy images', () => {
    const lazyImages = (n: number) =>
      Array.from(
        { length: n },
        (_, i) => `<img data-src="/img-${i}.jpg" id="img-${i}">`
      ).join('');

    it('loads up to six lazy images straight away', async () => {
      setupDom(lazyImages(6));
      await freshInit();

      pageLoad();

      for (let i = 0; i < 6; i++) {
        const img = $<HTMLImageElement>(`#img-${i}`);
        expect(img.getAttribute('src')).toBe(`/img-${i}.jpg`);
        expect(img.hasAttribute('data-src')).toBe(false);
      }
      // No observer is needed for six or fewer.
      expect(instances()).toHaveLength(0);
    });

    it('with more than six, observes them and loads each as it nears the viewport', async () => {
      setupDom(lazyImages(7));
      await freshInit();

      pageLoad();

      expect(lazyObserver().observed).toHaveLength(7);
      expect($('#img-0').hasAttribute('src')).toBe(false);

      lazyObserver().trigger([
        { isIntersecting: false, target: $('#img-1') },
        { isIntersecting: true, target: $('#img-0') },
      ]);

      expect($('#img-0').getAttribute('src')).toBe('/img-0.jpg');
      expect($('#img-0').hasAttribute('data-src')).toBe(false);
      expect(lazyObserver().unobserved.map((e) => e.id)).toEqual(['img-0']);
      // The one that is not intersecting stays unloaded.
      expect($('#img-1').hasAttribute('src')).toBe(false);
    });

    it('leaves lazy images alone when IntersectionObserver is unavailable', async () => {
      delete (window as unknown as Record<string, unknown>)
        .IntersectionObserver;
      setupDom(lazyImages(2));
      await freshInit();

      expect(() => pageLoad()).not.toThrow();

      expect($('#img-0').hasAttribute('src')).toBe(false);
    });
  });

  describe('articleGridReady', () => {
    it('re-runs the entrance animations after the filter coordinator swaps the grid', async () => {
      setupDom(card({ id: 'a' }));
      await freshInit();
      expect(instances()).toHaveLength(0);

      window.dispatchEvent(new Event('articleGridReady'));

      expect(cardObserver().observed.map((e) => e.id)).toEqual(['a']);
    });
  });

  describe('pageshow (back/forward cache)', () => {
    function pageShow(persisted: boolean): void {
      const event = new Event('pageshow') as PageTransitionEvent;
      Object.defineProperty(event, 'persisted', { value: persisted });
      window.dispatchEvent(event);
    }

    it('restored from the cache, shows half-animated cards at once without a transition', async () => {
      vi.useFakeTimers();
      setupDom(
        card({ id: 'a' }) +
          card({ id: 'b', classes: 'card-entrance-ready' }) +
          card({ id: 'c', classes: 'card-entrance-ready opacity-100' })
      );
      await freshInit();

      pageShow(true);

      for (const id of ['#a', '#b']) {
        expect($(id).classList.contains('opacity-0')).toBe(false);
        expect($(id).classList.contains('opacity-100')).toBe(true);
        expect($(id).style.transition).toBe('none');
      }
      // Already shown: untouched.
      expect($('#c').style.transition).toBe('');

      vi.advanceTimersByTime(50);
      expect($('#a').style.transition).toBe('');
      expect($('#b').style.transition).toBe('');
    });

    it('a normal page show changes nothing', async () => {
      setupDom(card({ id: 'a' }));
      await freshInit();

      pageShow(false);

      expect($('#a').classList.contains('opacity-0')).toBe(true);
      expect($('#a').style.transition).toBe('');
    });
  });

  describe('lifecycle', () => {
    it('a page-load after a swap animates the cards of the new page', async () => {
      setupDom(card({ id: 'old' }));
      await freshInit();
      pageLoad();

      setupDom(card({ id: 'new' }));
      pageLoad();

      const latest = instances().filter(
        (i) => i.options.rootMargin === '200px'
      );
      expect(latest.at(-1)!.observed.map((e) => e.id)).toEqual(['new']);
    });
  });
});
