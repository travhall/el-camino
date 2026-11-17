/**
 * Tests for imageShimmer (plan 225). Images opt in with
 * `data-shimmer-placeholder`; on load or error the skeleton is removed and the
 * `data-shimmer-*` attributes drive opacity and classes. happy-dom doesn't
 * load images, so `complete` / `naturalWidth` are set per image and load/error
 * events are dispatched by hand. The module keeps a MutationObserver and an
 * `astro:page-load` listener, so each test imports a fresh copy and tears both
 * down.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EL_CAMINO_LOGO_DATA_URI } from '@/lib/constants/assets';

let added: [string, EventListenerOrEventListenerObject][] = [];
let observers: MutationObserver[] = [];
const RealObserver = globalThis.MutationObserver;

function img(
  attrs: Record<string, string>,
  state: { complete?: boolean; naturalWidth?: number } = {}
): HTMLImageElement {
  const el = document.createElement('img');
  el.setAttribute('data-shimmer-placeholder', 'ph');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  Object.defineProperty(el, 'complete', {
    value: state.complete ?? false,
    configurable: true,
  });
  Object.defineProperty(el, 'naturalWidth', {
    value: state.naturalWidth ?? 0,
    configurable: true,
  });
  return el;
}

const placeholder = () => document.getElementById('ph');

async function boot() {
  vi.resetModules();
  await import('../imageShimmer');
}
const pageLoad = () => document.dispatchEvent(new Event('astro:page-load'));

beforeEach(() => {
  document.body.innerHTML = '<div id="ph"></div>';
  added = [];
  observers = [];
  const original = document.addEventListener.bind(document);
  vi.spyOn(document, 'addEventListener').mockImplementation(((
    type: string,
    fn: EventListenerOrEventListenerObject,
    opts?: boolean | AddEventListenerOptions
  ) => {
    added.push([type, fn]);
    return original(type, fn, opts);
  }) as typeof document.addEventListener);
  vi.stubGlobal(
    'MutationObserver',
    class extends RealObserver {
      constructor(cb: MutationCallback) {
        super(cb);
        observers.push(this);
      }
    }
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const [type, fn] of added) document.removeEventListener(type, fn);
  observers.forEach((o) => o.disconnect());
  vi.unstubAllGlobals();
});

describe('imageShimmer: images still loading', () => {
  it('removes the placeholder and applies load opacity and classes on load', async () => {
    const el = img({
      'data-shimmer-load-opacity': '0.9',
      'data-shimmer-load-remove': 'opacity-0 blur',
      'data-shimmer-load-add': 'opacity-100',
      class: 'opacity-0 blur keep',
    });
    document.body.appendChild(el);
    await boot();
    pageLoad();
    expect(placeholder()).not.toBeNull();

    el.dispatchEvent(new Event('load'));

    expect(placeholder()).toBeNull();
    expect(el.style.opacity).toBe('0.9');
    expect(el.classList.contains('opacity-0')).toBe(false);
    expect(el.classList.contains('blur')).toBe(false);
    expect(el.classList.contains('opacity-100')).toBe(true);
    expect(el.classList.contains('keep')).toBe(true);
  });

  it('clears inline opacity when the attribute is present but empty', async () => {
    const el = img({ 'data-shimmer-load-opacity': '' });
    el.style.opacity = '0';
    document.body.appendChild(el);
    await boot();
    pageLoad();

    el.dispatchEvent(new Event('load'));

    expect(el.style.opacity).toBe('');
  });

  it('leaves opacity alone when there is no opacity attribute', async () => {
    const el = img({});
    el.style.opacity = '0.4';
    document.body.appendChild(el);
    await boot();
    pageLoad();

    el.dispatchEvent(new Event('load'));

    expect(el.style.opacity).toBe('0.4');
  });

  it('on error swaps in the default logo, removes the placeholder, and uses error attributes', async () => {
    const el = img({
      'data-shimmer-load-opacity': '0.9',
      'data-shimmer-error-opacity': '1',
      'data-shimmer-error-add': 'errored',
      'data-shimmer-error-remove': 'loading',
      class: 'loading',
    });
    document.body.appendChild(el);
    await boot();
    pageLoad();

    el.dispatchEvent(new Event('error'));

    expect(el.getAttribute('src')).toBe(EL_CAMINO_LOGO_DATA_URI);
    expect(placeholder()).toBeNull();
    expect(el.style.opacity).toBe('1');
    expect(el.classList.contains('errored')).toBe(true);
    expect(el.classList.contains('loading')).toBe(false);
  });

  it('on error uses a custom fallback src when given', async () => {
    const el = img({ 'data-shimmer-fallback': '/fallback.png' });
    document.body.appendChild(el);
    await boot();
    pageLoad();

    el.dispatchEvent(new Event('error'));

    expect(el.getAttribute('src')).toBe('/fallback.png');
  });

  it('picks opacity-100 or opacity-75 by stock for images that ask for it', async () => {
    const inStock = img({ 'data-shimmer-stock': '', 'data-in-stock': 'true' });
    const soldOut = img({ 'data-shimmer-stock': '', 'data-in-stock': 'false' });
    document.body.append(inStock, soldOut);
    await boot();
    pageLoad();

    inStock.dispatchEvent(new Event('load'));
    soldOut.dispatchEvent(new Event('load'));

    expect(inStock.classList.contains('opacity-100')).toBe(true);
    expect(soldOut.classList.contains('opacity-75')).toBe(true);
    expect(soldOut.classList.contains('opacity-100')).toBe(false);
  });

  it('does not bind twice when the page-load handler runs again', async () => {
    const el = img({ 'data-shimmer-load-add': 'once' });
    const add = vi.spyOn(el, 'addEventListener');
    document.body.appendChild(el);
    await boot();
    pageLoad();
    pageLoad();

    expect(add.mock.calls.filter(([t]) => t === 'load')).toHaveLength(1);
  });
});

describe('imageShimmer: images already settled', () => {
  it('settles a cached image immediately as loaded', async () => {
    const el = img(
      { 'data-shimmer-load-opacity': '0.9' },
      { complete: true, naturalWidth: 100 }
    );
    document.body.appendChild(el);
    await boot();
    pageLoad();

    expect(placeholder()).toBeNull();
    expect(el.style.opacity).toBe('0.9');
    expect(el.getAttribute('src')).toBeNull();
  });

  it('settles an image that already failed as an error', async () => {
    const el = img({}, { complete: true, naturalWidth: 0 });
    document.body.appendChild(el);
    await boot();
    pageLoad();

    expect(placeholder()).toBeNull();
    expect(el.getAttribute('src')).toBe(EL_CAMINO_LOGO_DATA_URI);
  });

  it('applies the fallback once to an already-attached broken image, without looping', async () => {
    const el = img({ 'data-shimmer-attached': '1' }, { complete: true });
    document.body.appendChild(el);
    await boot();
    pageLoad();
    expect(el.getAttribute('src')).toBe(EL_CAMINO_LOGO_DATA_URI);

    el.setAttribute('src', 'changed');
    pageLoad();

    // The distinct flag stops a second swap
    expect(el.getAttribute('src')).toBe('changed');
  });

  it('leaves an already-attached healthy image alone', async () => {
    const el = img(
      { 'data-shimmer-attached': '1' },
      { complete: true, naturalWidth: 50 }
    );
    document.body.appendChild(el);
    await boot();
    pageLoad();

    expect(el.getAttribute('src')).toBeNull();
    expect(placeholder()).not.toBeNull();
  });

  it('ignores images that did not opt in', async () => {
    const plain = document.createElement('img');
    document.body.appendChild(plain);
    await boot();
    pageLoad();

    expect(plain.dataset.shimmerAttached).toBeUndefined();
  });
});

describe('imageShimmer: images added after the page painted', () => {
  async function flush() {
    // MutationObserver callbacks run as a microtask
    await Promise.resolve();
    await Promise.resolve();
  }

  it('attaches an image injected directly', async () => {
    await boot();
    pageLoad();
    const el = img({ 'data-shimmer-load-add': 'late' });

    document.body.appendChild(el);
    await flush();
    el.dispatchEvent(new Event('load'));

    expect(el.classList.contains('late')).toBe(true);
  });

  it('attaches opted-in images inside an injected subtree', async () => {
    await boot();
    pageLoad();
    const wrap = document.createElement('div');
    const el = img({ 'data-shimmer-load-add': 'nested' });
    wrap.appendChild(el);

    document.body.appendChild(wrap);
    await flush();
    el.dispatchEvent(new Event('load'));

    expect(el.classList.contains('nested')).toBe(true);
  });

  it('starts observing only once across navigations', async () => {
    await boot();
    pageLoad();
    pageLoad();
    pageLoad();

    expect(observers).toHaveLength(1);
  });
});
