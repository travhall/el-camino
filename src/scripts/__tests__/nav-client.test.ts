/**
 * Characterization tests for nav-client (plan 227, extracted from the inline
 * script in Nav.astro). Each test does a fresh `vi.resetModules()` + dynamic
 * import because the module holds module-level singleton state (the
 * `initialized` guard and the current controller).
 *
 * The module registers listeners on `document` and `window` that outlive a
 * test, so every `addEventListener` call on them is recorded in `beforeEach`
 * and undone in `afterEach`; otherwise an earlier test's copy of the module
 * would also react to the events a later test dispatches.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const prefetchHighPriorityTargets = vi.fn();
const getNavigationContext = vi.fn(() => ({
  currentPath: '/',
  isProductCategory: false,
  isMobile: true,
  isHomepage: true,
  categoryDepth: 0,
}));

vi.mock('@/lib/square/navigationClient', () => ({
  getNavigationContext: (...args: unknown[]) =>
    (getNavigationContext as (...a: unknown[]) => unknown)(...args),
  prefetchHighPriorityTargets: (...args: unknown[]) =>
    prefetchHighPriorityTargets(...args),
}));

type Recorded = {
  target: Window | Document;
  type: string;
  listener: EventListenerOrEventListenerObject;
};
let recorded: Recorded[] = [];

function setWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
    writable: true,
  });
}

function setupDom(): void {
  document.body.removeAttribute('data-active-category');
  document.body.innerHTML = `
    <a class="skip-link" href="#main-content">Skip</a>
    <header>
      <nav id="main-nav" class="">
        <div class="category-group">
          <a class="nav-item nav-link" href="/category/decks" data-category-name="Decks">Decks</a>
          <button class="mobile-expand-btn" data-category-name="Decks" aria-expanded="false"><span>+</span></button>
          <div class="dropdown-menu"><a href="/category/decks/street">Street</a></div>
        </div>
        <div class="category-group">
          <a class="nav-item nav-link" href="/category/wheels" data-category-name="Wheels">Wheels</a>
          <button class="mobile-expand-btn" data-category-name="Wheels" aria-expanded="false"><span>+</span></button>
          <div class="dropdown-menu"><a href="/category/wheels/street">Street</a></div>
        </div>
        <a class="nav-link" href="/category/apparel">Apparel</a>
      </nav>
    </header>
    <div id="nav-overlay" class="hidden opacity-0"></div>
    <main id="main-content" tabindex="-1"></main>
  `;
}

async function freshInit() {
  vi.resetModules();
  const mod = await import('../nav-client');
  mod.init();
  return mod;
}

const wait = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
const liveRegions = () => document.querySelectorAll('#nav-announcements');
const expandBtn = (n: number) =>
  document.querySelectorAll<HTMLElement>('.mobile-expand-btn')[n];
const group = (n: number) =>
  document.querySelectorAll<HTMLElement>('.category-group')[n];

describe('nav-client', () => {
  beforeEach(() => {
    recorded = [];
    for (const target of [document, window] as const) {
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
    if (typeof globalThis.ResizeObserver === 'undefined') {
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe() {}
          unobserve() {}
          disconnect() {}
        }
      );
    }
    prefetchHighPriorityTargets.mockClear();
    getNavigationContext.mockClear();
    setupDom();
    setWidth(500);
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    for (const { target, type, listener } of recorded) {
      target.removeEventListener(type, listener);
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('init', () => {
    it('builds the controller on first call: live region, portaled overlay, prefetch', async () => {
      await freshInit();

      expect(liveRegions()).toHaveLength(1);
      expect(liveRegions()[0].getAttribute('aria-live')).toBe('polite');
      // The overlay is moved to <body> so it escapes the header stacking context.
      const overlay = document.getElementById('nav-overlay') as HTMLElement;
      expect(overlay.parentElement).toBe(document.body);
      expect(prefetchHighPriorityTargets).toHaveBeenCalledTimes(1);
    });

    it('is guarded: a second init() does not build a second controller', async () => {
      const mod = await freshInit();
      mod.init();

      expect(liveRegions()).toHaveLength(1);
      expect(prefetchHighPriorityTargets).toHaveBeenCalledTimes(1);
    });

    it('waits for DOMContentLoaded while the document is still loading', async () => {
      vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
      await freshInit();
      expect(liveRegions()).toHaveLength(0);

      document.dispatchEvent(new Event('DOMContentLoaded'));
      expect(liveRegions()).toHaveLength(1);
    });
  });

  describe('dropdowns', () => {
    it('expands a category on mobile and updates aria state and the announcement', async () => {
      await freshInit();

      expandBtn(0).click();
      await wait();

      expect(group(0).classList.contains('open')).toBe(true);
      expect(expandBtn(0).getAttribute('aria-expanded')).toBe('true');
      expect(expandBtn(0).getAttribute('aria-label')).toBe(
        'Collapse Decks subcategories'
      );
      expect(liveRegions()[0].textContent).toBe('Decks menu expanded');
    });

    it('closes the other open category when a second one opens', async () => {
      await freshInit();

      expandBtn(0).click();
      await wait(260);
      expandBtn(1).click();
      await wait(60);

      expect(group(0).classList.contains('open')).toBe(false);
      expect(group(1).classList.contains('open')).toBe(true);
    });

    it('does nothing on desktop width, where the dropdown is CSS hover-driven', async () => {
      setWidth(1280);
      await freshInit();

      expandBtn(0).click();
      await wait();

      expect(group(0).classList.contains('open')).toBe(false);
    });

    it('closes every menu on Escape', async () => {
      await freshInit();
      expandBtn(0).click();
      await wait();
      expect(group(0).classList.contains('open')).toBe(true);

      document
        .querySelector('nav')!
        .dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );
      await wait();

      expect(group(0).classList.contains('open')).toBe(false);
      expect(liveRegions()[0].textContent).toBe('All menus closed');
    });

    it('moves focus into the open dropdown on ArrowDown from the expand button', async () => {
      await freshInit();
      expandBtn(0).click();
      await wait();

      expandBtn(0).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );

      expect(document.activeElement).toBe(
        group(0).querySelector('.dropdown-menu a')
      );
    });
  });

  describe('accessibility and active state', () => {
    it('skip link focuses #main-content instead of following the hash', async () => {
      await freshInit();
      const main = document.getElementById('main-content') as HTMLElement;
      main.scrollIntoView = vi.fn();

      const click = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      document.querySelector('.skip-link')!.dispatchEvent(click);

      expect(click.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(main);
    });

    it('marks the matching category link active on a product page', async () => {
      window.history.pushState({}, '', '/product/baker-825');
      document.body.setAttribute('data-active-category', 'wheels');
      await freshInit();

      const links = document.querySelectorAll('.nav-link');
      const wheels = [...links].find(
        (l) => l.getAttribute('href') === '/category/wheels'
      )!;
      const decks = [...links].find(
        (l) => l.getAttribute('href') === '/category/decks'
      )!;
      expect(wheels.classList.contains('lg:before:scale-x-100')).toBe(true);
      expect(decks.classList.contains('lg:before:scale-x-100')).toBe(false);
    });
  });

  describe('overlay', () => {
    it('shows when the nav opens on a narrow screen and hides when it closes', async () => {
      await freshInit();
      const nav = document.getElementById('main-nav') as HTMLElement;
      const overlay = document.getElementById('nav-overlay') as HTMLElement;

      nav.classList.add('nav-open');
      await wait();
      expect(overlay.classList.contains('hidden')).toBe(false);
      expect(overlay.classList.contains('opacity-0')).toBe(false);

      nav.classList.remove('nav-open');
      await wait(350);
      expect(overlay.classList.contains('opacity-0')).toBe(true);
      expect(overlay.classList.contains('hidden')).toBe(true);
    });
  });

  describe('lifecycle', () => {
    it('astro:before-swap tears the controller down and stops its listeners', async () => {
      await freshInit();
      expect(liveRegions()).toHaveLength(1);

      document.dispatchEvent(new Event('astro:before-swap'));

      expect(liveRegions()).toHaveLength(0);
      const overlay = document.getElementById('nav-overlay') as HTMLElement;
      expect(overlay.classList.contains('hidden')).toBe(true);

      // The skip-link listener was registered with the controller's abort
      // signal, so after teardown a click is no longer intercepted. (The
      // dropdown click handler would also be inert here, but only because
      // navElements was cleared, so it cannot prove the listener was removed.)
      const click = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      document.querySelector('.skip-link')!.dispatchEvent(click);
      expect(click.defaultPrevented).toBe(false);
    });

    it('astro:after-swap builds a fresh controller against the new DOM', async () => {
      await freshInit();
      document.dispatchEvent(new Event('astro:before-swap'));
      setupDom();

      document.dispatchEvent(new Event('astro:after-swap'));

      expect(liveRegions()).toHaveLength(1);
      expect(prefetchHighPriorityTargets).toHaveBeenCalledTimes(2);
      expandBtn(0).click();
      await wait();
      expect(group(0).classList.contains('open')).toBe(true);
    });

    it('pageshow from the back/forward cache resets the controller; a normal pageshow does not', async () => {
      await freshInit();

      const normal = new Event('pageshow') as PageTransitionEvent;
      Object.defineProperty(normal, 'persisted', { value: false });
      window.dispatchEvent(normal);
      expect(prefetchHighPriorityTargets).toHaveBeenCalledTimes(1);

      const restored = new Event('pageshow') as PageTransitionEvent;
      Object.defineProperty(restored, 'persisted', { value: true });
      window.dispatchEvent(restored);
      expect(prefetchHighPriorityTargets).toHaveBeenCalledTimes(2);
      expect(liveRegions()).toHaveLength(1);
    });

    it('visibilitychange resets only after the page was hidden for more than 5 minutes', async () => {
      await freshInit();
      const now = vi.spyOn(Date, 'now');
      const hidden = vi.spyOn(document, 'hidden', 'get');

      // Hidden, then visible again after 1 minute: no reset.
      now.mockReturnValue(1_000_000);
      hidden.mockReturnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));
      now.mockReturnValue(1_000_000 + 60_000);
      hidden.mockReturnValue(false);
      document.dispatchEvent(new Event('visibilitychange'));
      expect(prefetchHighPriorityTargets).toHaveBeenCalledTimes(1);

      // Hidden, then visible again after 6 minutes: reset.
      now.mockReturnValue(2_000_000);
      hidden.mockReturnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));
      now.mockReturnValue(2_000_000 + 6 * 60_000);
      hidden.mockReturnValue(false);
      document.dispatchEvent(new Event('visibilitychange'));
      expect(prefetchHighPriorityTargets).toHaveBeenCalledTimes(2);
      expect(liveRegions()).toHaveLength(1);
    });
  });
});
