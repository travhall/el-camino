/**
 * Characterization tests for mini-cart-client (plan 225).
 *
 * The module exports nothing: importing it registers an `astro:page-load`
 * listener, and everything else happens through DOM events. So each test does
 * `vi.resetModules()` + a dynamic import (the module keeps singleton state:
 * undo timer, pending undo item, inventory), mounts fixture markup, and
 * dispatches `astro:page-load` / `openMiniCart` / `cartUpdated` like the page
 * does. `@/lib/cart` is replaced by a small in-memory fake and fetch is
 * stubbed.
 *
 * Listeners the module puts on `document` and `window` outlive the test that
 * imported it, so they are recorded and removed in afterEach; otherwise the
 * next test would also run every earlier module instance.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CartItem } from '@/lib/cart/types';

const { fakeCart, showNotification } = vi.hoisted(() => {
  type Item = {
    id: string;
    variationId: string;
    price: number;
    quantity: number;
    saleInfo?: { salePrice: number };
  };
  const state = { items: [] as Item[] };
  const key = (i: Item) => `${i.id}:${i.variationId}`;
  const line = (i: Item) => (i.saleInfo?.salePrice ?? i.price) * i.quantity;
  const cart = {
    state,
    getItems: vi.fn(() => state.items),
    getTotal: vi.fn(() => state.items.reduce((s, i) => s + line(i), 0)),
    getItemCount: vi.fn(() => state.items.reduce((s, i) => s + i.quantity, 0)),
    updateQuantity: vi.fn(async (k: string, qty: number) => {
      const it = state.items.find((i) => key(i) === k);
      if (it) it.quantity = qty;
      return { success: true } as { success: boolean; message?: string };
    }),
    removeItem: vi.fn((k: string) => {
      state.items = state.items.filter((i) => key(i) !== k);
    }),
    addItem: vi.fn(async (item: Item) => {
      state.items.push(item);
      return { success: true } as { success: boolean; message?: string };
    }),
  };
  return { fakeCart: cart, showNotification: vi.fn() };
});

vi.mock('@/lib/cart', () => ({ cart: fakeCart }));
vi.mock('@/lib/events', () => ({ showNotification }));

const SHIP_THRESHOLD = 75;

const deck = {
  id: 'deck',
  variationId: 'v-deck',
  catalogObjectId: 'c-deck',
  title: 'Cool Deck',
  price: 60,
  quantity: 1,
  variationName: '8.25',
  image: 'https://items-images-sandbox.s3.amazonaws.com/deck.jpg',
  unit: 'UNIT',
} as CartItem;

const tee = {
  id: 'tee',
  variationId: 'v-tee',
  catalogObjectId: 'c-tee',
  title: 'Plain Tee',
  price: 25,
  quantity: 2,
  variationName: 'Black, M',
  image: '/local/tee.png',
  unit: 'UNIT',
} as CartItem;

const setItems = (...items: CartItem[]) => {
  fakeCart.state.items = items as unknown as typeof fakeCart.state.items;
};

function mountDom(): void {
  document.body.innerHTML = `
    <button id="trigger">open</button>
    <div id="mini-cart-overlay" class="hidden opacity-0"></div>
    <aside id="mini-cart-panel" class="translate-x-full">
      <button id="close-mini-cart">close</button>
      <div id="mini-cart-loading"></div>
      <div id="mini-cart-empty" class="hidden"></div>
      <div id="mini-cart-items" class="hidden"><div id="items-list"></div></div>
      <div id="mini-cart-footer" class="hidden">
        <span id="mini-cart-total"></span>
        <button id="continue-shopping-footer">keep</button>
        <button id="mini-cart-checkout">checkout</button>
      </div>
      <button id="continue-shopping">keep</button>
      <span id="mini-cart-count"></span>
      <div id="mini-cart-shipping-tracker" class="hidden">
        <span id="mini-cart-shipping-remaining"></span>
        <div id="mini-cart-shipping-progress"></div>
      </div>
      <div id="mini-cart-shipping-earned" class="hidden"></div>
      <div id="mini-cart-undo-bar" class="hidden opacity-0">
        <span id="mini-cart-undo-message"></span>
        <div id="mini-cart-undo-progress"></div>
        <button id="mini-cart-undo-btn">undo</button>
        <button id="mini-cart-undo-dismiss">x</button>
      </div>
    </aside>`;
}

type Listener = [EventTarget, string, EventListenerOrEventListenerObject];
let registered: Listener[] = [];
let fetchMock: ReturnType<typeof vi.fn>;

function stubInventory(inventory: Record<string, number> | 'fail' = {}) {
  fetchMock = vi.fn(async () => {
    if (inventory === 'fail') throw new Error('network down');
    return { ok: true, json: async () => ({ inventory }) };
  });
  vi.stubGlobal('fetch', fetchMock);
}

async function boot(): Promise<void> {
  vi.resetModules();
  await import('../mini-cart-client');
  document.dispatchEvent(new Event('astro:page-load'));
}

async function openCart(): Promise<void> {
  window.dispatchEvent(new Event('openMiniCart'));
  await vi.advanceTimersByTimeAsync(0);
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const hidden = (id: string) => $(id).classList.contains('hidden');
const click = async (el: Element) => {
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true })
  );
  await vi.advanceTimersByTimeAsync(0);
};
const rowButton = (action: string, itemKey: string) =>
  document.querySelector<HTMLButtonElement>(
    `button[data-action="${action}"][data-item-key="${itemKey}"]`
  )!;

beforeEach(() => {
  vi.useFakeTimers();
  mountDom();
  fakeCart.state.items = [];
  vi.clearAllMocks();
  stubInventory();
  registered = [];
  for (const target of [document, window] as EventTarget[]) {
    const original = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation(((
      type: string,
      fn: EventListenerOrEventListenerObject,
      opts?: boolean | AddEventListenerOptions
    ) => {
      registered.push([target, type, fn]);
      return original(type, fn, opts);
    }) as typeof target.addEventListener);
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const [target, type, fn] of registered)
    target.removeEventListener(type, fn);
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.style.overflow = '';
});

describe('rendering', () => {
  it('shows the empty state and hides the footer for an empty cart', async () => {
    await boot();
    await openCart();

    expect(hidden('mini-cart-empty')).toBe(false);
    expect(hidden('mini-cart-items')).toBe(true);
    expect(hidden('mini-cart-footer')).toBe(true);
    expect(hidden('mini-cart-loading')).toBe(true);
    expect($('mini-cart-count').textContent).toBe('0');
    // No inventory request for an empty cart
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders each item with count, formatted total and per-item price', async () => {
    setItems({ ...deck }, { ...tee });
    await boot();
    await openCart();

    expect($('mini-cart-count').textContent).toBe('3');
    expect($('mini-cart-total').textContent).toBe('$110.00');
    const list = $('items-list');
    expect(
      list.querySelectorAll('[data-item-key="deck:v-deck"]').length
    ).toBeGreaterThan(0);
    expect(list.textContent).toContain('Cool Deck');
    expect(list.textContent).toContain('8.25');
    expect(list.textContent).toContain('$60.00 each');
    // 2 x $25
    expect(list.textContent).toContain('$50.00');
    expect(hidden('mini-cart-footer')).toBe(false);
    expect(hidden('mini-cart-empty')).toBe(true);
  });

  it('escapes HTML in titles and variation names (nothing is injected as an element)', async () => {
    setItems({
      ...deck,
      title: '<img src=x onerror=alert(1)>',
      variationName: '"><script>alert(2)</script>',
    });
    await boot();
    await openCart();

    const list = $('items-list');
    // The only <img> is the real product image, and no script element exists
    expect(list.querySelectorAll('img')).toHaveLength(1);
    expect(list.querySelector('img[src="x"]')).toBeNull();
    expect(list.querySelector('script')).toBeNull();
    expect(list.querySelector('[onerror]')).toBeNull();
    // The hostile text is shown literally
    expect(list.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(list.textContent).toContain('"><script>alert(2)</script>');
  });

  it('shows the sale price, struck-through original and discount label', async () => {
    setItems({
      ...deck,
      saleInfo: { salePrice: 40, originalPrice: 60, discountPercent: 33 },
    } as CartItem);
    await boot();
    await openCart();

    const text = $('items-list').textContent!;
    expect(text).toContain('33% Off');
    expect(text).toContain('$60.00 each');
    expect(text).toContain('$40.00');
    expect($('mini-cart-total').textContent).toBe('$40.00');
  });

  it('derives the discount label when the sale has no percent', async () => {
    setItems({
      ...deck,
      saleInfo: { salePrice: 30, originalPrice: 60 },
    } as CartItem);
    await boot();
    await openCart();

    expect($('items-list').textContent).toContain('50% Off');
  });

  it('shows a placeholder icon instead of an image when the item has none', async () => {
    setItems({ ...deck, image: '' });
    await boot();
    await openCart();

    expect($('items-list').querySelector('img[data-cart-image]')).toBeNull();
    expect($('items-list').querySelector('svg')).not.toBeNull();
  });
});

describe('free-shipping tracker', () => {
  it('shows what is left and the progress when under the threshold', async () => {
    setItems({ ...tee, quantity: 1 }); // $25
    await boot();
    await openCart();

    expect(hidden('mini-cart-shipping-tracker')).toBe(false);
    expect(hidden('mini-cart-shipping-earned')).toBe(true);
    expect($('mini-cart-shipping-remaining').textContent).toBe('$50.00');
    expect($('mini-cart-shipping-progress').style.width).toBe(
      `${(25 / SHIP_THRESHOLD) * 100}%`
    );
  });

  it('flips to "earned" at exactly the threshold', async () => {
    setItems({ ...deck, price: 75 });
    await boot();
    await openCart();

    expect(hidden('mini-cart-shipping-tracker')).toBe(true);
    expect(hidden('mini-cart-shipping-earned')).toBe(false);
  });

  it('is still "remaining" one cent under', async () => {
    setItems({ ...deck, price: 74.99 });
    await boot();
    await openCart();

    expect(hidden('mini-cart-shipping-tracker')).toBe(false);
    expect($('mini-cart-shipping-remaining').textContent).toBe('$0.01');
  });
});

describe('images', () => {
  it('routes external images through the image CDN at 100x100 and leaves local ones alone', async () => {
    setItems({ ...deck }, { ...tee });
    await boot();
    await openCart();

    const imgs = $('items-list').querySelectorAll<HTMLImageElement>(
      'img[data-cart-image]'
    );
    const srcs = Array.from(imgs).map((i) => i.getAttribute('src')!);
    const cdn = srcs.find((s) => s.startsWith('/.netlify/images'))!;
    const params = new URLSearchParams(cdn.split('?')[1]);
    expect(params.get('url')).toBe(deck.image);
    expect(params.get('w')).toBe('100');
    expect(params.get('h')).toBe('100');
    expect(params.get('fit')).toBe('cover');
    expect(srcs).toContain('/local/tee.png');
  });

  it('removes the placeholder and fades the image in on load', async () => {
    setItems({ ...deck });
    await boot();
    await openCart();

    const img = $('items-list').querySelector<HTMLImageElement>(
      'img[data-cart-image]'
    )!;
    expect(
      document.getElementById('mini-cart-placeholder-deck:v-deck')
    ).not.toBe(null);
    img.dispatchEvent(new Event('load'));

    expect(img.style.opacity).toBe('0.9');
    expect(document.getElementById('mini-cart-placeholder-deck:v-deck')).toBe(
      null
    );
  });

  it('falls back to the logo and removes the placeholder on error', async () => {
    setItems({ ...deck });
    await boot();
    await openCart();

    const img = $('items-list').querySelector<HTMLImageElement>(
      'img[data-cart-image]'
    )!;
    img.dispatchEvent(new Event('error'));

    expect(img.getAttribute('src')).toMatch(/^data:/);
    expect(img.style.opacity).toBe('1');
    expect(document.getElementById('mini-cart-placeholder-deck:v-deck')).toBe(
      null
    );
  });
});

describe('inventory limits', () => {
  it('asks the inventory endpoint for the cart variations once per display', async () => {
    setItems({ ...deck }, { ...tee });
    await boot();
    await openCart();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/cart-inventory');
    expect(JSON.parse(init.body)).toEqual({
      variationIds: ['v-deck', 'v-tee'],
    });
  });

  it('disables "increase" when the quantity has reached stock', async () => {
    stubInventory({ 'v-tee': 2 });
    setItems({ ...tee }); // quantity 2
    await boot();
    await openCart();

    expect(rowButton('increase', 'tee:v-tee').disabled).toBe(true);
    expect(rowButton('decrease', 'tee:v-tee').disabled).toBe(false);
  });

  it('disables "decrease" at quantity 1', async () => {
    setItems({ ...deck });
    await boot();
    await openCart();

    expect(rowButton('decrease', 'deck:v-deck').disabled).toBe(true);
  });

  it('still renders when the inventory request fails', async () => {
    stubInventory('fail');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setItems({ ...deck });
    await boot();
    await openCart();

    expect($('items-list').textContent).toContain('Cool Deck');
    expect(warn).toHaveBeenCalled();
  });
});

describe('quantity controls', () => {
  it('"increase" updates the cart and the displayed quantity, count and total in place', async () => {
    setItems({ ...deck });
    await boot();
    await openCart();

    await click(rowButton('increase', 'deck:v-deck'));

    expect(fakeCart.updateQuantity).toHaveBeenCalledWith('deck:v-deck', 2);
    expect($('mini-cart-count').textContent).toBe('2');
    expect($('mini-cart-total').textContent).toBe('$120.00');
    expect(
      $('items-list').querySelector('.w-10.text-center')!.textContent
    ).toBe('2');
    expect(rowButton('decrease', 'deck:v-deck').disabled).toBe(false);
  });

  it('refuses to go past stock and says how many are available', async () => {
    stubInventory({ 'v-deck': 1 });
    setItems({ ...deck });
    await boot();
    await openCart();

    // The button renders disabled; enable it as a stale render could leave it
    const inc = rowButton('increase', 'deck:v-deck');
    inc.disabled = false;
    await click(inc);

    expect(fakeCart.updateQuantity).not.toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledWith('Only 1 available', 'error');
  });

  it('"decrease" above 1 lowers the quantity', async () => {
    setItems({ ...tee }); // 2
    await boot();
    await openCart();

    await click(rowButton('decrease', 'tee:v-tee'));

    expect(fakeCart.updateQuantity).toHaveBeenCalledWith('tee:v-tee', 1);
    expect(fakeCart.removeItem).not.toHaveBeenCalled();
    expect($('mini-cart-count').textContent).toBe('1');
  });

  it('"remove" removes the item, redraws the list and offers undo', async () => {
    setItems({ ...deck }, { ...tee });
    await boot();
    await openCart();

    await click(rowButton('remove', 'deck:v-deck'));

    expect(fakeCart.removeItem).toHaveBeenCalledWith('deck:v-deck');
    expect($('items-list').textContent).not.toContain('Cool Deck');
    expect(hidden('mini-cart-undo-bar')).toBe(false);
    expect($('mini-cart-undo-message').textContent).toBe('"Cool Deck" removed');
  });

  it('removing the last item shows the empty state', async () => {
    setItems({ ...deck });
    await boot();
    await openCart();

    await click(rowButton('remove', 'deck:v-deck'));

    expect(hidden('mini-cart-empty')).toBe(false);
    expect(hidden('mini-cart-footer')).toBe(true);
  });

  it('a click that is not on a control does nothing', async () => {
    setItems({ ...deck });
    await boot();
    await openCart();

    await click($('items-list'));

    expect(fakeCart.updateQuantity).not.toHaveBeenCalled();
    expect(fakeCart.removeItem).not.toHaveBeenCalled();
  });

  it('reports an error if the cart throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setItems({ ...deck, quantity: 3 });
    await boot();
    await openCart();
    fakeCart.updateQuantity.mockRejectedValueOnce(new Error('boom'));

    await click(rowButton('decrease', 'deck:v-deck'));

    expect(showNotification).toHaveBeenCalledWith(
      'Error updating cart',
      'error'
    );
  });

  it('clicking a product link closes the cart without cancelling navigation', async () => {
    setItems({ ...deck });
    await boot();
    await openCart();
    $('mini-cart-panel').classList.remove('translate-x-full');
    const link =
      $('items-list').querySelector<HTMLAnchorElement>('a.product-link')!;
    expect(link.getAttribute('href')).toBe('/product/cool-deck');

    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(false);
    expect($('mini-cart-overlay').classList.contains('opacity-0')).toBe(true);
    expect($('mini-cart-panel').hasAttribute('inert')).toBe(true);
  });
});

describe('undo', () => {
  async function removeDeck() {
    setItems({ ...deck }, { ...tee });
    await boot();
    await openCart();
    await click(rowButton('remove', 'deck:v-deck'));
  }

  it('restores the removed item and says so', async () => {
    await removeDeck();

    await click($('mini-cart-undo-btn'));

    expect(fakeCart.addItem).toHaveBeenCalledTimes(1);
    expect(fakeCart.addItem.mock.calls[0][0]).toMatchObject({
      id: 'deck',
      quantity: 1,
    });
    expect(showNotification).toHaveBeenCalledWith(
      '"Cool Deck" restored',
      'success'
    );
    expect($('items-list').textContent).toContain('Cool Deck');
  });

  it('restores the exact snapshot quantity when the item was re-added meanwhile', async () => {
    setItems({ ...deck, quantity: 3 }, { ...tee });
    await boot();
    await openCart();
    await click(rowButton('remove', 'deck:v-deck'));
    fakeCart.state.items.push({ ...deck, quantity: 1 } as never);

    await click($('mini-cart-undo-btn'));

    expect(fakeCart.addItem).not.toHaveBeenCalled();
    expect(fakeCart.updateQuantity).toHaveBeenCalledWith('deck:v-deck', 3);
  });

  it('surfaces the cart message when restoring fails', async () => {
    await removeDeck();
    fakeCart.addItem.mockResolvedValueOnce({
      success: false,
      message: 'Out of stock',
    });

    await click($('mini-cart-undo-btn'));

    expect(showNotification).toHaveBeenCalledWith('Out of stock', 'error');
  });

  it('reports a generic error when restoring throws', async () => {
    await removeDeck();
    fakeCart.addItem.mockRejectedValueOnce(new Error('boom'));

    await click($('mini-cart-undo-btn'));

    expect(showNotification).toHaveBeenCalledWith(
      'Could not restore item',
      'error'
    );
  });

  it('expires after 6 seconds: the bar hides and undo no longer does anything', async () => {
    await removeDeck();

    await vi.advanceTimersByTimeAsync(6000);
    await vi.advanceTimersByTimeAsync(200);
    expect(hidden('mini-cart-undo-bar')).toBe(true);

    await click($('mini-cart-undo-btn'));
    expect(fakeCart.addItem).not.toHaveBeenCalled();
  });

  it('the dismiss button hides the bar and forgets the item', async () => {
    await removeDeck();

    await click($('mini-cart-undo-dismiss'));
    await vi.advanceTimersByTimeAsync(200);

    expect(hidden('mini-cart-undo-bar')).toBe(true);
    await click($('mini-cart-undo-btn'));
    expect(fakeCart.addItem).not.toHaveBeenCalled();
  });

  it('a second removal replaces the first undo target and restarts the timer', async () => {
    await removeDeck();
    await vi.advanceTimersByTimeAsync(4000);
    await click(rowButton('remove', 'tee:v-tee'));
    await vi.advanceTimersByTimeAsync(4000); // 8s since first, 4s since second

    expect($('mini-cart-undo-message').textContent).toBe('"Plain Tee" removed');
    expect(hidden('mini-cart-undo-bar')).toBe(false);
  });
});

describe('opening and closing', () => {
  it('opening reveals the panel, locks scroll, focuses close and loads the cart', async () => {
    setItems({ ...deck });
    await boot();
    $('trigger').focus();

    await openCart();
    await vi.advanceTimersByTimeAsync(20);

    expect(hidden('mini-cart-overlay')).toBe(false);
    expect($('mini-cart-overlay').classList.contains('opacity-0')).toBe(false);
    expect($('mini-cart-panel').classList.contains('translate-x-full')).toBe(
      false
    );
    expect($('mini-cart-panel').hasAttribute('inert')).toBe(false);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe($('close-mini-cart'));
    expect($('items-list').textContent).toContain('Cool Deck');
  });

  it('closing hides it after the animation and returns focus to the trigger', async () => {
    await boot();
    $('trigger').focus();
    await openCart();
    await vi.advanceTimersByTimeAsync(20);

    await click($('close-mini-cart'));
    expect($('mini-cart-panel').hasAttribute('inert')).toBe(true);
    expect(document.body.style.overflow).toBe('unset');
    expect(hidden('mini-cart-overlay')).toBe(false);

    await vi.advanceTimersByTimeAsync(300);
    expect(hidden('mini-cart-overlay')).toBe(true);
    expect($('mini-cart-panel').hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe($('trigger'));
  });

  it.each([
    ['the overlay', 'mini-cart-overlay'],
    ['"continue shopping"', 'continue-shopping'],
    ['the footer "continue shopping"', 'continue-shopping-footer'],
  ])('%s closes the cart', async (_name, id) => {
    setItems({ ...deck });
    await boot();
    await openCart();
    await vi.advanceTimersByTimeAsync(20);

    await click($(id));

    expect($('mini-cart-panel').hasAttribute('inert')).toBe(true);
    expect($('mini-cart-overlay').classList.contains('opacity-0')).toBe(true);
  });

  it('closing dismisses a pending undo bar', async () => {
    setItems({ ...deck }, { ...tee });
    await boot();
    await openCart();
    await vi.advanceTimersByTimeAsync(20);
    await click(rowButton('remove', 'deck:v-deck'));

    await click($('close-mini-cart'));
    await vi.advanceTimersByTimeAsync(300);

    expect(hidden('mini-cart-undo-bar')).toBe(true);
  });

  it('Escape closes an open cart', async () => {
    await boot();
    await openCart();
    await vi.advanceTimersByTimeAsync(20);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect($('mini-cart-panel').hasAttribute('inert')).toBe(true);
  });

  it('Escape does nothing while the cart is closed', async () => {
    await boot();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect($('mini-cart-panel').hasAttribute('inert')).toBe(false);
    expect(document.body.style.overflow).not.toBe('unset');
  });

  it('Tab from the last control wraps to the first, Shift+Tab from the first to the last', async () => {
    await boot();
    await openCart();
    await vi.advanceTimersByTimeAsync(20);
    const panel = $('mini-cart-panel');
    // happy-dom has no layout, so offsetParent is null; treat everything as visible
    for (const el of Array.from(panel.querySelectorAll<HTMLElement>('*'))) {
      Object.defineProperty(el, 'offsetParent', {
        get: () => panel,
        configurable: true,
      });
    }
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    first.focus();
    const shiftTab = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      cancelable: true,
    });
    document.dispatchEvent(shiftTab);
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });
});

describe('checkout button', () => {
  it('tells the shopper the cart is empty instead of navigating', async () => {
    await boot();

    await click($('mini-cart-checkout'));

    expect(showNotification).toHaveBeenCalledWith(
      'Your cart is empty',
      'error'
    );
  });

  it('with items, does not complain', async () => {
    setItems({ ...deck });
    await boot();

    // Navigation itself (window.location.href = '/cart') is not observable in
    // happy-dom; the empty-cart guard above is the logic under test.
    await click($('mini-cart-checkout'));

    expect(showNotification).not.toHaveBeenCalled();
  });
});

describe('lifecycle across navigations', () => {
  it('re-initializing on astro:page-load does not stack handlers on window', async () => {
    setItems({ ...deck });
    await boot();
    document.dispatchEvent(new Event('astro:page-load'));
    document.dispatchEvent(new Event('astro:page-load'));
    fetchMock.mockClear();

    window.dispatchEvent(new Event('cartUpdated'));
    await vi.advanceTimersByTimeAsync(0);

    // One display refresh, so one inventory request
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cartUpdated redraws the cart from the current items', async () => {
    setItems({ ...deck });
    await boot();
    await openCart();
    expect($('mini-cart-count').textContent).toBe('1');

    setItems({ ...deck, quantity: 4 });
    window.dispatchEvent(new Event('cartUpdated'));
    await vi.advanceTimersByTimeAsync(0);

    expect($('mini-cart-count').textContent).toBe('4');
  });

  it('a fresh DOM after navigation is wired up again', async () => {
    await boot();
    mountDom(); // the swap replaces the markup
    setItems({ ...deck });

    document.dispatchEvent(new Event('astro:page-load'));
    await openCart();

    expect($('items-list').textContent).toContain('Cool Deck');
  });

  it('logs and does not throw when the cart markup is missing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = '<p>no cart here</p>';

    await boot();

    expect(error).toHaveBeenCalledWith('Mini cart elements not found');
  });

  it('logs and recovers when the cart throws while redrawing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await boot();
    fakeCart.getItems.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    await openCart();

    expect(error).toHaveBeenCalled();
    expect(hidden('mini-cart-loading')).toBe(true);
    expect(hidden('mini-cart-empty')).toBe(false);
  });
});
