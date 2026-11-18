/**
 * Tests for size-guide-client (plan 235). SizeGuide.astro's script used to be
 * `<script is:inline nonce>`, which only exists on product pages. When a shopper
 * arrives at a product by client-side navigation (the normal way), Astro's
 * router re-creates the script with the destination response's nonce, which
 * never matches the CSP nonce the browser is still enforcing from the first
 * page load, so the browser blocks it and the "Size Guide" button does nothing.
 * As a hoisted module it is an external file, allowed by `script-src 'self'`.
 *
 * A module executes once per document, but the category differs per product, so
 * it is read from `#size-guide-config` when the dialog opens, not at load time.
 *
 * Each test does a fresh `vi.resetModules()` + dynamic import because the module
 * holds module-level state (the `initialized` guard). The listeners it registers
 * on `document` outlive a test, so every `addEventListener` call is recorded in
 * `beforeEach` and undone in `afterEach`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type Recorded = {
  type: string;
  listener: EventListenerOrEventListenerObject;
};
let recorded: Recorded[] = [];

function pageHtml(category: string | null = 'tops', withPortal = true): string {
  return `
    ${withPortal ? '<div id="portal-root"></div>' : ''}
    <button type="button" id="size-guide-trigger">Size Guide</button>
    ${
      category === null
        ? ''
        : `<script type="application/json" id="size-guide-config">${JSON.stringify({ category })}</script>`
    }`;
}

function setupDom(category: string | null = 'tops', withPortal = true): void {
  document.body.style.overflow = '';
  document.body.innerHTML = pageHtml(category, withPortal);
}

async function freshInit() {
  vi.resetModules();
  const mod = await import('../size-guide-client');
  mod.init();
  return mod;
}

function pageLoad(): void {
  document.dispatchEvent(new Event('astro:page-load'));
}

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector(selector) as T;
const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement;
const trigger = () => $('#size-guide-trigger');
const rows = () =>
  [...document.querySelectorAll('tbody tr')].map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => td.textContent!.trim())
  );
const headers = () =>
  [...document.querySelectorAll('thead th')].map((th) =>
    th.textContent!.trim()
  );

async function open(): Promise<void> {
  trigger().click();
  await vi.advanceTimersByTimeAsync(20);
}

describe('size-guide-client', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    recorded = [];
    const original = document.addEventListener.bind(document) as (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) => void;
    vi.spyOn(document, 'addEventListener').mockImplementation(
      (type: string, listener: unknown, options?: unknown) => {
        recorded.push({
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
    setupDom();
  });

  afterEach(() => {
    for (const { type, listener } of recorded) {
      document.removeEventListener(type, listener);
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
    document.body.style.overflow = '';
  });

  describe('init', () => {
    it('is guarded: a second init() registers nothing further', async () => {
      const mod = await freshInit();
      const before = recorded.length;
      mod.init();

      expect(recorded).toHaveLength(before);
    });

    it('binds the trigger straight away when the document has loaded, and again on every page-load', async () => {
      await freshInit();
      expect(trigger().dataset.initialized).toBe('true');

      setupDom('bottoms');
      expect(trigger().dataset.initialized).toBeUndefined();
      pageLoad();

      expect(trigger().dataset.initialized).toBe('true');
    });

    it('waits for DOMContentLoaded while the document is still loading', async () => {
      vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
      await freshInit();
      expect(trigger().dataset.initialized).toBeUndefined();

      document.dispatchEvent(new Event('DOMContentLoaded'));

      expect(trigger().dataset.initialized).toBe('true');
    });

    it('does nothing on a page without the trigger', async () => {
      document.body.innerHTML = '<p>no size guide</p>';
      await freshInit();

      expect(() => pageLoad()).not.toThrow();
    });

    it('binds a trigger only once, so one click opens one dialog', async () => {
      await freshInit();
      pageLoad();
      pageLoad();

      await open();

      expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    });
  });

  describe('opening', () => {
    it('shows an accessible dialog in the portal root and locks scroll', async () => {
      await freshInit();

      await open();

      expect($('#portal-root').contains(dialog())).toBe(true);
      expect(dialog().getAttribute('aria-modal')).toBe('true');
      expect(dialog().getAttribute('aria-labelledby')).toBe('size-guide-title');
      expect($('#size-guide-title').textContent!.trim()).toBe('Size Guide');
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('fades the dialog in on the next frame', async () => {
      await freshInit();
      trigger().click();

      expect(dialog().classList.contains('opacity-0')).toBe(true);
      await vi.advanceTimersByTimeAsync(20);

      expect(dialog().classList.contains('opacity-0')).toBe(false);
      const panel = dialog().firstElementChild as HTMLElement;
      expect(panel.classList.contains('scale-100')).toBe(true);
      expect(panel.classList.contains('scale-95')).toBe(false);
    });

    it('moves focus to the close button', async () => {
      await freshInit();

      await open();

      expect(document.activeElement).toBe($('#size-guide-close'));
    });

    it('shows the tops chart for a tops product', async () => {
      await freshInit();

      await open();

      expect(dialog().textContent).toContain('Tops & Outerwear');
      expect(headers()).toEqual(['Size', 'Chest', 'Waist', 'Hips']);
      expect(rows().map((r) => r[0])).toEqual([
        'XS',
        'S',
        'M',
        'L',
        'XL',
        '2XL',
      ]);
      expect(rows()[2]).toEqual(['M', '37–39"', '29–31"', '39–41"']);
    });

    it('shows the bottoms chart for a bottoms product', async () => {
      setupDom('bottoms');
      await freshInit();

      await open();

      expect(dialog().textContent).toContain('Bottoms & Pants');
      expect(headers()).toEqual(['Waist', 'Waist (actual)', 'Hip', 'Inseam']);
      expect(rows().map((r) => r[0])).toEqual([
        '28',
        '30',
        '32',
        '34',
        '36',
        '38',
      ]);
      expect(rows()[3]).toEqual(['34', '34"', '34"', '33"']);
    });

    it('reads the category when it opens, so a different product after a soft navigation gets its own chart', async () => {
      await freshInit();
      await open();
      expect(dialog().textContent).toContain('Tops & Outerwear');
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
      await vi.advanceTimersByTimeAsync(300);

      // The router swapped in a bottoms product; the module did not re-run.
      setupDom('bottoms');
      pageLoad();
      await open();

      expect(dialog().textContent).toContain('Bottoms & Pants');
      expect(headers()).toEqual(['Waist', 'Waist (actual)', 'Hip', 'Inseam']);
    });

    it('falls back to the tops chart when the config is missing', async () => {
      setupDom(null);
      await freshInit();

      await open();

      expect(dialog().textContent).toContain('Tops & Outerwear');
    });

    it('falls back to the tops chart when the config cannot be parsed', async () => {
      $('#size-guide-config').textContent = '{not json';
      await freshInit();

      await open();

      expect(dialog().textContent).toContain('Tops & Outerwear');
    });

    it('treats an unknown category as bottoms, as the inline script did', async () => {
      setupDom('shoes');
      await freshInit();

      await open();

      expect(dialog().textContent).toContain('Bottoms & Pants');
    });

    it('opens nothing and leaves scroll alone when there is no portal root', async () => {
      setupDom('tops', false);
      await freshInit();

      await open();

      expect(dialog()).toBeNull();
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('closing', () => {
    async function close(how: () => void) {
      await freshInit();
      trigger().focus();
      await open();
      how();
    }

    it.each([
      ['the close button', () => $('#size-guide-close').click()],
      [
        'Escape',
        () =>
          document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
          ),
      ],
      ['a click on the backdrop', () => dialog().click()],
    ])(
      'closes from %s: fades out, then removes the dialog, unlocks scroll and returns focus',
      async (_name, how) => {
        await close(how);

        expect(dialog().classList.contains('opacity-0')).toBe(true);
        // Still in the DOM while it fades.
        await vi.advanceTimersByTimeAsync(299);
        expect(dialog()).not.toBeNull();

        await vi.advanceTimersByTimeAsync(1);
        expect(dialog()).toBeNull();
        expect(document.body.style.overflow).toBe('unset');
        expect(document.activeElement).toBe(trigger());
      }
    );

    it('a click inside the dialog panel does not close it', async () => {
      await freshInit();
      await open();

      (dialog().firstElementChild as HTMLElement).click();
      await vi.advanceTimersByTimeAsync(300);

      expect(dialog()).not.toBeNull();
    });

    it('stops listening for keys once closed', async () => {
      await close(() => $('#size-guide-close').click());
      await vi.advanceTimersByTimeAsync(300);

      // A later Escape must not run the close handler again: it would hand
      // focus back to the trigger and reset the scroll lock a second time.
      const elsewhere = document.createElement('button');
      document.body.appendChild(elsewhere);
      elsewhere.focus();
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
      await vi.advanceTimersByTimeAsync(300);

      expect(document.activeElement).toBe(elsewhere);
      expect(dialog()).toBeNull();
    });
  });

  describe('keyboard focus is trapped in the dialog', () => {
    it('Tab on the last focusable element wraps to the first', async () => {
      await freshInit();
      await open();
      const close = $('#size-guide-close');
      close.focus();

      const tab = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(tab);

      expect(tab.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(close);
    });

    it('Shift+Tab on the first focusable element wraps to the last', async () => {
      await freshInit();
      await open();
      $('#size-guide-close').focus();

      const shiftTab = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(shiftTab);

      expect(shiftTab.defaultPrevented).toBe(true);
    });

    it('other keys are left alone', async () => {
      await freshInit();
      await open();

      const key = new KeyboardEvent('keydown', {
        key: 'a',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(key);

      expect(key.defaultPrevented).toBe(false);
      expect(dialog()).not.toBeNull();
    });
  });
});
