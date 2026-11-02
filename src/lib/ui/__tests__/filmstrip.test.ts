/**
 * The filmstrip's previous/next buttons, in happy-dom. happy-dom does no
 * layout, so scroll geometry is faked on the viewport element.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initFilmstrip, initFilmstrips } from '../filmstrip';

function setupDom(): HTMLElement {
  document.body.innerHTML = `
    <div data-filmstrip id="strip">
      <div data-filmstrip-controls data-overflow="false">
        <button type="button" data-filmstrip-prev aria-disabled="true">prev</button>
        <button type="button" data-filmstrip-next aria-disabled="true">next</button>
      </div>
      <div data-filmstrip-viewport><div>cards</div></div>
    </div>`;
  return document.getElementById('strip')!;
}

interface Geometry {
  scrollWidth: number;
  clientWidth: number;
  scrollLeft: number;
}

function fakeGeometry(root: HTMLElement, g: Geometry) {
  const viewport = root.querySelector<HTMLElement>(
    '[data-filmstrip-viewport]'
  )!;
  const scrollBy = vi.fn();
  for (const key of ['scrollWidth', 'clientWidth', 'scrollLeft'] as const) {
    Object.defineProperty(viewport, key, {
      configurable: true,
      get: () => g[key],
      set: (v: number) => (g[key] = v),
    });
  }
  viewport.scrollBy = scrollBy as unknown as typeof viewport.scrollBy;
  return { viewport, scrollBy, g };
}

const q = (sel: string) => document.querySelector<HTMLElement>(sel)!;
const disabled = (sel: string) => q(sel).getAttribute('aria-disabled');
const overflow = () => q('[data-filmstrip-controls]').dataset.overflow;

describe('initFilmstrip', () => {
  let cleanup: () => void;
  let root: HTMLElement;

  beforeEach(() => {
    root = setupDom();
    window.matchMedia = vi.fn(() => ({
      matches: false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => cleanup?.());

  const start = (g: Geometry) => {
    const fake = fakeGeometry(root, g);
    cleanup = initFilmstrip(root);
    return fake;
  };

  describe('state', () => {
    it('hides the controls when everything already fits', () => {
      start({ scrollWidth: 800, clientWidth: 800, scrollLeft: 0 });

      expect(overflow()).toBe('false');
      expect(disabled('[data-filmstrip-prev]')).toBe('true');
      expect(disabled('[data-filmstrip-next]')).toBe('true');
    });

    it('shows them when it overflows; at the start only "next" is available', () => {
      start({ scrollWidth: 1700, clientWidth: 1000, scrollLeft: 0 });

      expect(overflow()).toBe('true');
      expect(disabled('[data-filmstrip-prev]')).toBe('true');
      expect(disabled('[data-filmstrip-next]')).toBe('false');
    });

    it('in the middle both are available', () => {
      start({ scrollWidth: 1700, clientWidth: 1000, scrollLeft: 300 });

      expect(disabled('[data-filmstrip-prev]')).toBe('false');
      expect(disabled('[data-filmstrip-next]')).toBe('false');
    });

    it('at the end only "previous" is available, allowing for sub-pixel positions', () => {
      start({ scrollWidth: 1700, clientWidth: 1000, scrollLeft: 699.5 });

      expect(disabled('[data-filmstrip-prev]')).toBe('false');
      expect(disabled('[data-filmstrip-next]')).toBe('true');
    });

    it('follows the scroll position as it changes', () => {
      const { viewport, g } = start({
        scrollWidth: 1700,
        clientWidth: 1000,
        scrollLeft: 0,
      });

      g.scrollLeft = 700;
      viewport.dispatchEvent(new Event('scroll'));

      expect(disabled('[data-filmstrip-prev]')).toBe('false');
      expect(disabled('[data-filmstrip-next]')).toBe('true');
    });

    it('re-checks on window resize (the strip can stop overflowing)', () => {
      const { g } = start({
        scrollWidth: 1700,
        clientWidth: 1000,
        scrollLeft: 0,
      });
      expect(overflow()).toBe('true');

      g.clientWidth = 1700;
      window.dispatchEvent(new Event('resize'));

      expect(overflow()).toBe('false');
    });
  });

  describe('buttons', () => {
    it('"next" scrolls forward about a screen, smoothly', () => {
      const { scrollBy } = start({
        scrollWidth: 1700,
        clientWidth: 1000,
        scrollLeft: 0,
      });

      q('[data-filmstrip-next]').click();

      expect(scrollBy).toHaveBeenCalledWith({ left: 800, behavior: 'smooth' });
    });

    it('"previous" scrolls back by the same step', () => {
      const { scrollBy } = start({
        scrollWidth: 1700,
        clientWidth: 1000,
        scrollLeft: 500,
      });

      q('[data-filmstrip-prev]').click();

      expect(scrollBy).toHaveBeenCalledWith({ left: -800, behavior: 'smooth' });
    });

    it('never steps less than a card or so, even in a narrow viewport', () => {
      const { scrollBy } = start({
        scrollWidth: 1700,
        clientWidth: 100,
        scrollLeft: 0,
      });

      q('[data-filmstrip-next]').click();

      expect(scrollBy).toHaveBeenCalledWith({ left: 200, behavior: 'smooth' });
    });

    it('does not scroll when the button is aria-disabled (the end of the row)', () => {
      const { scrollBy } = start({
        scrollWidth: 1700,
        clientWidth: 1000,
        scrollLeft: 700,
      });

      q('[data-filmstrip-next]').click();

      expect(scrollBy).not.toHaveBeenCalled();
    });

    it('keeps focus on a button that reaches its end (aria-disabled, not disabled)', () => {
      const { viewport, g } = start({
        scrollWidth: 1700,
        clientWidth: 1000,
        scrollLeft: 0,
      });
      const nextBtn = q('[data-filmstrip-next]');
      nextBtn.focus();

      g.scrollLeft = 700;
      viewport.dispatchEvent(new Event('scroll'));

      expect(disabled('[data-filmstrip-next]')).toBe('true');
      expect(nextBtn.hasAttribute('disabled')).toBe(false);
      expect(document.activeElement).toBe(nextBtn);
    });

    it('does not animate for people who ask for reduced motion', () => {
      window.matchMedia = vi.fn(() => ({
        matches: true,
      })) as unknown as typeof window.matchMedia;
      const { scrollBy } = start({
        scrollWidth: 1700,
        clientWidth: 1000,
        scrollLeft: 0,
      });

      q('[data-filmstrip-next]').click();

      expect(scrollBy).toHaveBeenCalledWith({ left: 800, behavior: 'auto' });
    });
  });

  describe('lifecycle', () => {
    it('cleanup detaches the listeners', () => {
      const { scrollBy } = start({
        scrollWidth: 1700,
        clientWidth: 1000,
        scrollLeft: 0,
      });

      cleanup();
      q('[data-filmstrip-next]').click();

      expect(scrollBy).not.toHaveBeenCalled();
    });

    it('does nothing without a viewport', () => {
      document.body.innerHTML = '<div data-filmstrip id="empty"></div>';
      expect(
        () => (cleanup = initFilmstrip(document.getElementById('empty')!))
      ).not.toThrow();
    });
  });
});

describe('initFilmstrips', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn(() => ({
      matches: false,
    })) as unknown as typeof window.matchMedia;
  });

  it('wires each filmstrip once, however many times it is called', () => {
    const root = setupDom();
    const { scrollBy } = fakeGeometry(root, {
      scrollWidth: 1700,
      clientWidth: 1000,
      scrollLeft: 0,
    });

    initFilmstrips();
    initFilmstrips();
    q('[data-filmstrip-next]').click();

    expect(scrollBy).toHaveBeenCalledTimes(1);
  });

  it('wires one that was swapped in later', () => {
    initFilmstrips();
    const root = setupDom();
    const { scrollBy } = fakeGeometry(root, {
      scrollWidth: 1700,
      clientWidth: 1000,
      scrollLeft: 0,
    });

    initFilmstrips();
    q('[data-filmstrip-next]').click();

    expect(scrollBy).toHaveBeenCalledTimes(1);
  });
});
