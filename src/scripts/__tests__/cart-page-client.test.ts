/**
 * Characterization tests for cart-page-client (plan 229, extracted from the
 * hoisted script in pages/cart.astro). Each test does a fresh
 * `vi.resetModules()` + dynamic import because the module holds module-level
 * state (the `initialized` guard, `inventoryData`, `isUpdating`, the
 * fulfillment-valid flag and two debounce timers).
 *
 * The module registers an `astro:page-load` listener on `document` and writes
 * `window.updateOrderSummaryOnFulfillmentChange`; every `addEventListener` on
 * `window` and `document` is recorded in `beforeEach` and undone in
 * `afterEach`, so an earlier test's copy of the module never reacts to a later
 * test's events.
 *
 * What this script owns: rendering the cart rows, quantity changes, undo,
 * clear, the order summary (the authoritative totals come from the server,
 * `/api/calculate-cart`) and the checkout request (`/api/create-checkout`).
 * The cart itself (`@/lib/cart`) is mocked with a small stateful fake.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CartItem } from '@/lib/cart/types';

const { state, cart, showNotification } = vi.hoisted(() => {
  const state = { items: [] as CartItem[] };
  const key = (i: CartItem) => `${i.id}:${i.variationId}`;
  const cart = {
    getItems: vi.fn(() => state.items),
    getTotal: vi.fn(() =>
      state.items.reduce(
        (sum, i) => sum + (i.saleInfo?.salePrice || i.price) * i.quantity,
        0
      )
    ),
    getItemCount: vi.fn(() =>
      state.items.reduce((sum, i) => sum + i.quantity, 0)
    ),
    updateQuantity: vi.fn(async (k: string, quantity: number) => {
      state.items = state.items.map((i) =>
        key(i) === k ? { ...i, quantity } : i
      );
    }),
    removeItem: vi.fn((k: string) => {
      state.items = state.items.filter((i) => key(i) !== k);
    }),
    addItem: vi.fn(
      async (
        item: CartItem
      ): Promise<{ success: boolean; message?: string }> => {
        state.items = [...state.items, item];
        return { success: true };
      }
    ),
    clear: vi.fn(() => {
      state.items = [];
    }),
    reconcileWithServerCart: vi.fn(),
  };
  return { state, cart, showNotification: vi.fn() };
});

vi.mock('@/lib/cart', () => ({ cart }));
vi.mock('@/lib/events', () => ({ showNotification }));

type Recorded = {
  target: Window | Document;
  type: string;
  listener: EventListenerOrEventListenerObject;
};
let recorded: Recorded[] = [];

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'ITEM1',
    catalogObjectId: 'ITEM1',
    variationId: 'VAR1',
    title: 'Deck 8.0',
    price: 60,
    quantity: 1,
    image: 'https://img.example.com/deck.jpg',
    variationName: 'Black',
    ...overrides,
  };
}

const field = (id: string, value = '') => `<input id="${id}" value="${value}">`;

const FIXTURE = `
  <div id="cart-loading"></div>
  <div id="empty-cart" class="hidden"></div>
  <div id="cart-content" class="hidden">
    <div id="clear-cart-wrapper" class="hidden">
      <button id="clear-cart-button">Clear</button>
    </div>
    <p id="cart-step-subtitle"></p>
    <span id="cart-step-indicator">Step 1 of 2</span>
    <div id="fulfillment-selector-wrapper" data-has-gift-card="false">
      <div id="fulfillment-summary-chip" class="hidden"></div>
      <input type="radio" name="fulfillment" id="fulfillment-shipping" value="shipping">
      <input type="radio" name="fulfillment" id="fulfillment-pickup" value="pickup">
      <div data-shipping-form>
        ${field('shipping-first-name')}${field('shipping-last-name')}
        ${field('shipping-email')}${field('shipping-phone')}
        ${field('shipping-address')}${field('shipping-address2')}
        ${field('shipping-city')}
        <select id="shipping-state"><option value=""></option><option value="TX">TX</option></select>
        ${field('shipping-zip')}
        <textarea id="shipping-instructions"></textarea>
      </div>
      <div data-pickup-form>
        ${field('pickup-name')}${field('pickup-email')}${field('pickup-phone')}
        <textarea id="pickup-notes"></textarea>
      </div>
    </div>
    <div id="cart-items-list"></div>
    <span id="subtotal">$0.00</span>
    <span id="tax-amount">—</span>
    <span id="shipping-cost">—</span>
    <span id="order-total-label">Estimated Total</span>
    <span id="order-total">$0.00</span>
    <button id="checkout-button" disabled>Continue</button>
    <p id="checkout-hint"></p>
  </div>
  <div id="mobile-checkout-bar" class="hidden">
    <span id="mobile-subtotal">$0.00</span>
    <p id="mobile-checkout-hint"></p>
    <button id="mobile-checkout-button" disabled>Continue</button>
  </div>
  <div id="loading-overlay" class="hidden"></div>`;

type FetchHandler = (body: unknown) => unknown | Promise<unknown>;
let handlers: Record<string, FetchHandler> = {};
const fetchMock = vi.fn();

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return { ok, status, json: async () => body } as Response;
}

const calcOk = (shipping = 5.99, tax = 4.5, total = 70.49) =>
  jsonResponse({ success: true, shipping, tax, total });

function defaultHandlers(): Record<string, FetchHandler> {
  return {
    '/api/cart-inventory': () => jsonResponse({ success: true, inventory: {} }),
    '/api/calculate-cart': () => calcOk(),
    '/api/create-checkout': () =>
      jsonResponse({ checkoutUrl: 'https://pay.example.com/c/1' }),
  };
}

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector(selector) as T;
const byId = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const text = (id: string) => byId(id).textContent?.trim();
const hidden = (id: string) => byId(id).classList.contains('hidden');
const calls = (url: string) =>
  fetchMock.mock.calls.filter(([u]) => u === url) as [string, RequestInit][];
const bodyOf = (call: [string, RequestInit]) =>
  JSON.parse(call[1].body as string);

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

async function freshInit() {
  vi.resetModules();
  const mod = await import('../cart-page-client');
  mod.init();
  return mod;
}

/** Init, fire astro:page-load and let the first render finish. */
async function load(items: CartItem[] = [item()]) {
  state.items = items;
  const mod = await freshInit();
  document.dispatchEvent(new Event('astro:page-load'));
  await flush();
  return mod;
}

function chooseFulfillment(value: 'shipping' | 'pickup' | null): void {
  for (const r of document.querySelectorAll<HTMLInputElement>(
    'input[name="fulfillment"]'
  ))
    r.checked = r.value === value;
}

function fillShipping(overrides: Record<string, string> = {}): void {
  const values: Record<string, string> = {
    'shipping-first-name': 'Test',
    'shipping-last-name': 'Buyer',
    'shipping-email': 'buyer@example.com',
    'shipping-phone': '5559876543',
    'shipping-address': '123 Example St',
    'shipping-address2': 'Apt 2',
    'shipping-city': 'Austin',
    'shipping-state': 'TX',
    'shipping-zip': '78701',
    'shipping-instructions': 'Leave at door',
    ...overrides,
  };
  for (const [id, value] of Object.entries(values))
    (byId(id) as HTMLInputElement).value = value;
}

function fillPickup(): void {
  (byId('pickup-name') as HTMLInputElement).value = 'Pat Pickup';
  (byId('pickup-email') as HTMLInputElement).value = 'pat@example.com';
  (byId('pickup-phone') as HTMLInputElement).value = '5551112222';
  (byId('pickup-notes') as HTMLTextAreaElement).value = 'After 5pm';
}

type FulfillmentCallback = (
  method: string,
  formData?: Record<string, string>,
  formIsValid?: boolean,
  shouldRecalculate?: boolean
) => void;
const fulfillmentChanged = (...args: Parameters<FulfillmentCallback>) =>
  (
    window as unknown as {
      updateOrderSummaryOnFulfillmentChange: FulfillmentCallback;
    }
  ).updateOrderSummaryOnFulfillmentChange(...args);

const expandForm = vi.fn();
let hrefValue = '';

describe('cart-page-client', () => {
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
            options as AddEventListenerOptions
          );
        }
      );
    }

    document.body.innerHTML = FIXTURE;
    state.items = [];
    handlers = defaultHandlers();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const handler = handlers[url];
      if (!handler) throw new Error(`unexpected fetch ${url}`);
      return handler(init?.body ? JSON.parse(init.body as string) : undefined);
    });
    vi.stubGlobal('fetch', fetchMock);

    for (const fn of Object.values(cart))
      (fn as ReturnType<typeof vi.fn>).mockClear();
    showNotification.mockClear();
    expandForm.mockClear();
    sessionStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    hrefValue = 'http://localhost/cart';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return hrefValue;
        },
        set href(v: string) {
          hrefValue = v;
        },
      },
    });
    (window as unknown as Record<string, unknown>).elco_expandFulfillmentForm =
      expandForm;
    delete (window as unknown as Record<string, unknown>).showModal;
    delete (window as unknown as Record<string, unknown>)
      .updateOrderSummaryOnFulfillmentChange;
  });

  afterEach(() => {
    for (const { target, type, listener } of recorded)
      target.removeEventListener(type, listener);
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('init', () => {
    it('registers exactly one astro:page-load listener, even when called twice', async () => {
      const mod = await freshInit();
      mod.init();
      const pageLoad = recorded.filter(
        (r) => r.target === document && r.type === 'astro:page-load'
      );
      expect(pageLoad).toHaveLength(1);
    });

    it('does nothing to the page until astro:page-load fires', async () => {
      state.items = [item()];
      await freshInit();
      await flush();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(byId('cart-items-list').innerHTML).toBe('');
    });

    it('exposes the fulfillment callback only after page-load', async () => {
      await freshInit();
      expect(
        (window as unknown as Record<string, unknown>)
          .updateOrderSummaryOnFulfillmentChange
      ).toBeUndefined();
      document.dispatchEvent(new Event('astro:page-load'));
      await flush();
      expect(
        typeof (window as unknown as Record<string, unknown>)
          .updateOrderSummaryOnFulfillmentChange
      ).toBe('function');
    });
  });

  describe('empty cart', () => {
    it('shows the empty state and hides the content', async () => {
      await load([]);
      expect(hidden('empty-cart')).toBe(false);
      expect(hidden('cart-content')).toBe(true);
      expect(hidden('cart-loading')).toBe(true);
      expect(hidden('clear-cart-wrapper')).toBe(true);
    });

    it('hides the mobile checkout bar and disables checkout', async () => {
      await load([]);
      expect(hidden('mobile-checkout-bar')).toBe(true);
      expect((byId('checkout-button') as HTMLButtonElement).disabled).toBe(
        true
      );
      expect(text('cart-step-indicator')).toBe('Step 1 of 2');
    });

    it('does not ask the server for inventory or totals', async () => {
      await load([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('rendering items', () => {
    it('shows the content, the clear button and the subtotal', async () => {
      await load([item({ quantity: 2 })]);
      expect(hidden('empty-cart')).toBe(true);
      expect(hidden('cart-content')).toBe(false);
      expect(hidden('clear-cart-wrapper')).toBe(false);
      expect(text('subtotal')).toBe('$120.00');
    });

    it('renders one container per line with its product link, title and variation', async () => {
      await load([
        item(),
        item({ id: 'ITEM2', variationId: 'VAR2', title: 'Wheels 52mm' }),
      ]);
      const rows = document.querySelectorAll('[data-item-container]');
      expect(rows).toHaveLength(2);
      expect((rows[0] as HTMLElement).dataset.itemContainer).toBe('ITEM1:VAR1');
      expect(rows[0].querySelector('a')?.getAttribute('href')).toBe(
        '/product/deck-80'
      );
      expect(rows[0].textContent).toContain('Black');
      expect(rows[1].textContent).toContain('Wheels 52mm');
    });

    it('escapes HTML in titles, variation names and image URLs', async () => {
      await load([
        item({
          title: '<img src=x onerror=alert(1)>',
          variationName: '"><script>x</script>',
          image: 'https://img.example.com/a.jpg" onerror="alert(1)',
        }),
      ]);
      const list = byId('cart-items-list');
      expect(list.querySelector('script')).toBeNull();
      expect(list.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(list.querySelector('img[onerror]')).toBeNull();
      expect(list.querySelector('h3')?.textContent?.trim()).toBe(
        '<img src=x onerror=alert(1)>'
      );
      const img = list.querySelector('img[data-shimmer-placeholder]');
      expect(img?.getAttribute('src')).toBe(
        'https://img.example.com/a.jpg" onerror="alert(1)'
      );
    });

    it('uses the logo image when the item has no image', async () => {
      await load([item({ image: undefined })]);
      const img = byId('cart-items-list').querySelector('img');
      expect(img?.getAttribute('src')).toMatch(/^data:/);
      expect(
        byId('cart-items-list').querySelector('[data-shimmer-placeholder]')
      ).toBeNull();
    });

    it('prices the line at the sale price and labels it with the discount', async () => {
      await load([
        item({
          price: 100,
          quantity: 2,
          saleInfo: {
            salePrice: 80,
            originalPrice: 100,
            discountPercent: 20,
          } as CartItem['saleInfo'],
        }),
      ]);
      const row = $('[data-item-container]');
      expect(row.textContent).toContain('$160.00');
      expect(row.textContent).toContain('$100.00 each');
      expect(row.textContent).toContain('20% Off');
      expect(text('subtotal')).toBe('$160.00');
    });

    it('works out the discount when saleInfo has no discountPercent', async () => {
      await load([
        item({
          price: 100,
          saleInfo: {
            salePrice: 75,
            originalPrice: 100,
          } as CartItem['saleInfo'],
        }),
      ]);
      expect($('[data-item-container]').textContent).toContain('25% Off');
    });

    it('shows the mobile bar with the subtotal', async () => {
      await load([item({ quantity: 3 })]);
      expect(hidden('mobile-checkout-bar')).toBe(false);
      expect(text('mobile-subtotal')).toBe('$180.00');
    });

    it('tells the fulfillment selector whether the cart holds a gift card', async () => {
      const seen: boolean[] = [];
      document.addEventListener('cart:giftcard', (e) =>
        seen.push((e as CustomEvent).detail.hasGiftCard)
      );
      await load([item({ isGiftCard: true })]);
      expect(seen).toEqual([true]);
      expect(byId('fulfillment-selector-wrapper').dataset.hasGiftCard).toBe(
        'true'
      );
    });

    it('reports no gift card for an ordinary cart', async () => {
      await load([item()]);
      expect(byId('fulfillment-selector-wrapper').dataset.hasGiftCard).toBe(
        'false'
      );
    });
  });

  describe('inventory', () => {
    it('asks for inventory of the non-gift-card variations only', async () => {
      await load([
        item(),
        item({ id: 'G', variationId: 'GV', isGiftCard: true }),
      ]);
      const [call] = calls('/api/cart-inventory');
      expect(call[1].method).toBe('POST');
      expect(bodyOf(call)).toEqual({ variationIds: ['VAR1'] });
    });

    it('shows "Only N left" under ten and caps the quantity input', async () => {
      handlers['/api/cart-inventory'] = () =>
        jsonResponse({ success: true, inventory: { VAR1: 3 } });
      await load([item({ quantity: 1 })]);
      expect($('[data-item-container]').textContent).toContain('Only 3 left');
      expect(
        ($('input.quantity-input') as HTMLInputElement).getAttribute('max')
      ).toBe('3');
    });

    it('shows "Out of stock" and disables increase at zero', async () => {
      handlers['/api/cart-inventory'] = () =>
        jsonResponse({ success: true, inventory: { VAR1: 0 } });
      await load([item()]);
      expect($('[data-item-container]').textContent).toContain('Out of stock');
      expect($<HTMLButtonElement>('[data-action="increase"]').disabled).toBe(
        true
      );
    });

    it('disables increase when the quantity reaches the stock', async () => {
      handlers['/api/cart-inventory'] = () =>
        jsonResponse({ success: true, inventory: { VAR1: 2 } });
      await load([item({ quantity: 2 })]);
      expect($<HTMLButtonElement>('[data-action="increase"]').disabled).toBe(
        true
      );
    });

    it('disables decrease at quantity 1', async () => {
      await load([item({ quantity: 1 })]);
      expect($<HTMLButtonElement>('[data-action="decrease"]').disabled).toBe(
        true
      );
    });

    it('shows "Only 9 left" just under the threshold', async () => {
      handlers['/api/cart-inventory'] = () =>
        jsonResponse({ success: true, inventory: { VAR1: 9 } });
      await load([item()]);
      expect($('[data-item-container]').textContent).toContain('Only 9 left');
    });

    it('shows no stock message at ten or more', async () => {
      handlers['/api/cart-inventory'] = () =>
        jsonResponse({ success: true, inventory: { VAR1: 10 } });
      await load([item()]);
      const t = $('[data-item-container]').textContent;
      expect(t).not.toContain('left');
      expect(t).not.toContain('Out of stock');
    });

    it('assumes 99 in stock when the inventory request fails', async () => {
      handlers['/api/cart-inventory'] = () => jsonResponse({}, false, 500);
      await load([item({ quantity: 5 })]);
      expect(
        ($('input.quantity-input') as HTMLInputElement).getAttribute('max')
      ).toBe('99');
      expect($('[data-item-container]').textContent).not.toContain('left');
    });

    it('assumes 99 in stock when the response says it failed', async () => {
      handlers['/api/cart-inventory'] = () =>
        jsonResponse({ success: false, error: 'nope' });
      await load([item()]);
      expect(
        ($('input.quantity-input') as HTMLInputElement).getAttribute('max')
      ).toBe('99');
    });

    it('lets a gift card go up to ten regardless of stock', async () => {
      await load([item({ isGiftCard: true, quantity: 9 })]);
      expect($<HTMLButtonElement>('[data-action="increase"]').disabled).toBe(
        false
      );
      await load([item({ isGiftCard: true, quantity: 10 })]);
      expect($<HTMLButtonElement>('[data-action="increase"]').disabled).toBe(
        true
      );
    });
  });

  describe('quantity buttons', () => {
    it('increase adds one and updates the totals in place', async () => {
      await load([item({ quantity: 1 })]);
      $<HTMLButtonElement>('[data-action="increase"]').click();
      await flush();
      expect(cart.updateQuantity).toHaveBeenCalledWith('ITEM1:VAR1', 2);
      expect(($('input.quantity-input') as HTMLInputElement).value).toBe('2');
      expect(text('subtotal')).toBe('$120.00');
    });

    it('increase past the stock is refused with a message', async () => {
      handlers['/api/cart-inventory'] = () =>
        jsonResponse({ success: true, inventory: { VAR1: 1 } });
      await load([item({ quantity: 1 })]);
      // the button is disabled, so drive the handler by enabling it
      const btn = $<HTMLButtonElement>('[data-action="increase"]');
      btn.disabled = false;
      btn.click();
      await flush();
      expect(cart.updateQuantity).not.toHaveBeenCalled();
      expect(showNotification).toHaveBeenCalledWith(
        'Only 1 available',
        'error'
      );
    });

    it('increase up to exactly the stock is allowed', async () => {
      handlers['/api/cart-inventory'] = () =>
        jsonResponse({ success: true, inventory: { VAR1: 2 } });
      await load([item({ quantity: 1 })]);
      $<HTMLButtonElement>('[data-action="increase"]').click();
      await flush();
      expect(cart.updateQuantity).toHaveBeenCalledWith('ITEM1:VAR1', 2);
      expect(showNotification).not.toHaveBeenCalled();
    });

    it('decrease takes one off when more than one', async () => {
      await load([item({ quantity: 3 })]);
      $<HTMLButtonElement>('[data-action="decrease"]').click();
      await flush();
      expect(cart.updateQuantity).toHaveBeenCalledWith('ITEM1:VAR1', 2);
      expect(cart.removeItem).not.toHaveBeenCalled();
    });

    it('decrease at 1 is disabled in the markup, so nothing happens', async () => {
      await load([item({ quantity: 1 })]);
      $<HTMLButtonElement>('[data-action="decrease"]').click();
      await flush();
      expect(cart.updateQuantity).not.toHaveBeenCalled();
      expect(cart.removeItem).not.toHaveBeenCalled();
    });

    it('updates the line subtotal and the buttons after a change', async () => {
      await load([item({ quantity: 1 })]);
      $<HTMLButtonElement>('[data-action="increase"]').click();
      await flush();
      expect($<HTMLButtonElement>('[data-action="decrease"]').disabled).toBe(
        false
      );
    });

    it('clicking the SVG inside a button still counts (closest)', async () => {
      await load([item({ quantity: 1 })]);
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      $('[data-action="increase"]').appendChild(svg);
      svg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
      expect(cart.updateQuantity).toHaveBeenCalledWith('ITEM1:VAR1', 2);
    });

    it('shows an error when the cart throws', async () => {
      await load([item({ quantity: 1 })]);
      cart.updateQuantity.mockRejectedValueOnce(new Error('boom'));
      $<HTMLButtonElement>('[data-action="increase"]').click();
      await flush();
      expect(showNotification).toHaveBeenCalledWith(
        'Error updating cart',
        'error'
      );
    });
  });

  describe('remove and undo', () => {
    function lastAction() {
      const call = showNotification.mock.calls.at(-1)!;
      return call[3] as { label: string; onClick: () => Promise<void> };
    }

    it('remove deletes the line and offers Undo for six seconds', async () => {
      await load([item(), item({ id: 'B', variationId: 'VB', title: 'Grip' })]);
      $<HTMLButtonElement>('[data-action="remove"]').click();
      await flush();
      expect(cart.removeItem).toHaveBeenCalledWith('ITEM1:VAR1');
      expect(showNotification).toHaveBeenCalledWith(
        '"Deck 8.0" removed',
        'success',
        6000,
        expect.objectContaining({ label: 'Undo' })
      );
      expect(document.querySelectorAll('[data-item-container]')).toHaveLength(
        1
      );
    });

    it('Undo puts the item back and says so', async () => {
      await load([item(), item({ id: 'B', variationId: 'VB', title: 'Grip' })]);
      $<HTMLButtonElement>('[data-action="remove"]').click();
      await flush();
      await lastAction().onClick();
      await flush();
      expect(cart.addItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ITEM1' })
      );
      expect(showNotification).toHaveBeenLastCalledWith(
        '"Deck 8.0" restored',
        'success'
      );
      expect(document.querySelectorAll('[data-item-container]')).toHaveLength(
        2
      );
    });

    it('Undo sets the quantity when the item is already back in the cart', async () => {
      await load([item({ quantity: 2 }), item({ id: 'B', variationId: 'VB' })]);
      $<HTMLButtonElement>('[data-action="remove"]').click();
      await flush();
      state.items = [...state.items, item({ quantity: 1 })];
      await lastAction().onClick();
      expect(cart.updateQuantity).toHaveBeenCalledWith('ITEM1:VAR1', 2);
      expect(cart.addItem).not.toHaveBeenCalled();
    });

    it('Undo shows the cart message when the item cannot be restored', async () => {
      await load([item(), item({ id: 'B', variationId: 'VB' })]);
      $<HTMLButtonElement>('[data-action="remove"]').click();
      await flush();
      cart.addItem.mockResolvedValueOnce({
        success: false,
        message: 'Out of stock now',
      });
      await lastAction().onClick();
      expect(showNotification).toHaveBeenLastCalledWith(
        'Out of stock now',
        'error'
      );
    });

    it('Undo falls back to a generic message when the cart gives none', async () => {
      await load([item(), item({ id: 'B', variationId: 'VB' })]);
      $<HTMLButtonElement>('[data-action="remove"]').click();
      await flush();
      cart.addItem.mockResolvedValueOnce({ success: false });
      await lastAction().onClick();
      expect(showNotification).toHaveBeenLastCalledWith(
        'Could not restore item',
        'error'
      );
    });

    it('Undo reports a throw from the cart', async () => {
      await load([item(), item({ id: 'B', variationId: 'VB' })]);
      $<HTMLButtonElement>('[data-action="remove"]').click();
      await flush();
      cart.addItem.mockRejectedValueOnce(new Error('x'));
      await lastAction().onClick();
      expect(showNotification).toHaveBeenLastCalledWith(
        'Could not restore item',
        'error'
      );
    });

    it('decrease on a quantity of one (button forced on) removes with a six-second Undo', async () => {
      await load([item({ quantity: 1 }), item({ id: 'B', variationId: 'VB' })]);
      const btn = $<HTMLButtonElement>('[data-action="decrease"]');
      btn.disabled = false;
      btn.click();
      await flush();
      expect(cart.removeItem).toHaveBeenCalledWith('ITEM1:VAR1');
      expect(showNotification).toHaveBeenCalledWith(
        '"Deck 8.0" removed',
        'success',
        6000,
        expect.objectContaining({ label: 'Undo' })
      );
      await lastAction().onClick();
      await flush();
      expect(showNotification).toHaveBeenLastCalledWith(
        '"Deck 8.0" restored',
        'success'
      );
    });

    it('removing the last line brings back the empty state', async () => {
      await load([item()]);
      $<HTMLButtonElement>('[data-action="remove"]').click();
      await flush();
      expect(hidden('empty-cart')).toBe(false);
      expect(hidden('cart-content')).toBe(true);
    });
  });

  describe('typing a quantity', () => {
    async function type(value: string) {
      const input = $('input.quantity-input') as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    async function loadFake(items = [item({ quantity: 1 })]) {
      await load(items);
      vi.useFakeTimers();
    }

    it('waits 500 ms, then updates the cart', async () => {
      await loadFake();
      await type('4');
      await vi.advanceTimersByTimeAsync(499);
      expect(cart.updateQuantity).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(cart.updateQuantity).toHaveBeenCalledWith('ITEM1:VAR1', 4);
    });

    it('only the last keystroke in the window counts', async () => {
      await loadFake();
      await type('2');
      await vi.advanceTimersByTimeAsync(300);
      await type('3');
      await vi.advanceTimersByTimeAsync(500);
      expect(cart.updateQuantity).toHaveBeenCalledTimes(1);
      expect(cart.updateQuantity).toHaveBeenCalledWith('ITEM1:VAR1', 3);
    });

    it('resets a quantity below one to 1 and does not update', async () => {
      await loadFake();
      await type('0');
      await vi.advanceTimersByTimeAsync(500);
      expect(($('input.quantity-input') as HTMLInputElement).value).toBe('1');
      expect(cart.updateQuantity).not.toHaveBeenCalled();
    });

    it('clamps a quantity above stock to the stock with a message', async () => {
      handlers['/api/cart-inventory'] = () =>
        jsonResponse({ success: true, inventory: { VAR1: 5 } });
      await loadFake();
      await type('9');
      await vi.advanceTimersByTimeAsync(500);
      expect(($('input.quantity-input') as HTMLInputElement).value).toBe('5');
      expect(showNotification).toHaveBeenCalledWith(
        'Only 5 available',
        'error'
      );
      expect(cart.updateQuantity).not.toHaveBeenCalled();
    });

    it('reports a cart error', async () => {
      await loadFake();
      cart.updateQuantity.mockRejectedValueOnce(new Error('x'));
      await type('2');
      await vi.advanceTimersByTimeAsync(500);
      expect(showNotification).toHaveBeenCalledWith(
        'Error updating quantity',
        'error'
      );
    });

    it('ignores input events from other fields', async () => {
      await loadFake();
      const other = document.createElement('input');
      other.dataset.itemKey = 'ITEM1:VAR1';
      byId('cart-items-list').appendChild(other);
      other.value = '8';
      other.dispatchEvent(new Event('input', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(600);
      expect(cart.updateQuantity).not.toHaveBeenCalled();
    });
  });

  describe('order summary', () => {
    it('without a fulfillment choice shows dashes and an estimate', async () => {
      await load([item({ quantity: 2 })]);
      expect(text('tax-amount')).toBe('—');
      expect(text('shipping-cost')).toBe('—');
      expect(text('order-total-label')).toBe('Estimated Total');
      expect(text('order-total')).toBe('$120.00');
      expect(calls('/api/calculate-cart')).toHaveLength(0);
    });

    it('asks the server and shows its shipping, tax and total', async () => {
      chooseFulfillment('shipping');
      await load([item()]);
      const [call] = calls('/api/calculate-cart');
      expect(bodyOf(call)).toEqual({
        items: state.items,
        fulfillmentMethod: 'shipping',
      });
      expect(text('shipping-cost')).toBe('$5.99');
      expect(text('tax-amount')).toBe('$4.50');
      expect(text('order-total')).toBe('$70.49');
      expect(text('order-total-label')).toBe('Order Total');
    });

    it('shows FREE when the server says shipping is zero', async () => {
      handlers['/api/calculate-cart'] = () => calcOk(0, 5, 65);
      chooseFulfillment('shipping');
      await load([item()]);
      expect(text('shipping-cost')).toBe('FREE');
    });

    it('shows Calculating… while the request is out', async () => {
      let release: (r: Response) => void = () => {};
      handlers['/api/calculate-cart'] = () =>
        new Promise<Response>((r) => (release = r));
      chooseFulfillment('pickup');
      await load([item()]);
      expect(text('shipping-cost')).toBe('Calculating…');
      release(calcOk(0, 4, 64));
      await flush();
      expect(text('shipping-cost')).toBe('FREE');
    });

    it('falls back to the estimate when the server errors', async () => {
      handlers['/api/calculate-cart'] = () =>
        jsonResponse({ success: false, error: 'bad' });
      chooseFulfillment('shipping');
      await load([item()]);
      expect(text('shipping-cost')).toBe('—');
      expect(text('order-total-label')).toBe('Estimated Total');
      expect(text('order-total')).toBe('$60.00');
    });

    it('falls back to the estimate when the request throws', async () => {
      handlers['/api/calculate-cart'] = () => {
        throw new Error('offline');
      };
      chooseFulfillment('shipping');
      await load([item()]);
      expect(text('order-total')).toBe('$60.00');
    });

    it('a quantity change recalculates once, 400 ms later', async () => {
      chooseFulfillment('shipping');
      await load([item({ quantity: 1 })]);
      fetchMock.mockClear();
      vi.useFakeTimers();
      $<HTMLButtonElement>('[data-action="increase"]').click();
      await vi.advanceTimersByTimeAsync(0);
      $<HTMLButtonElement>('[data-action="increase"]').click();
      await vi.advanceTimersByTimeAsync(399);
      expect(calls('/api/calculate-cart')).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      expect(calls('/api/calculate-cart')).toHaveLength(1);
    });
  });

  describe('fulfillment callback and the checkout button', () => {
    const btn = () => byId('checkout-button') as HTMLButtonElement;
    const mobileBtn = () => byId('mobile-checkout-button') as HTMLButtonElement;

    it('starts disabled with the hint showing', async () => {
      await load([item()]);
      expect(btn().disabled).toBe(true);
      expect(hidden('checkout-hint')).toBe(false);
    });

    it('an invalid form dims both buttons', async () => {
      await load([item()]);
      fulfillmentChanged('shipping', {}, false, false);
      for (const b of [btn(), mobileBtn()]) {
        expect(b.classList.contains('opacity-50')).toBe(true);
        expect(b.classList.contains('cursor-not-allowed')).toBe(true);
      }
    });

    it('a valid form enables both buttons, hides the hints and moves to step two', async () => {
      await load([item()]);
      fulfillmentChanged('shipping', {}, true, false);
      for (const b of [btn(), mobileBtn()]) {
        expect(b.disabled).toBe(false);
        expect(b.classList.contains('opacity-50')).toBe(false);
        expect(b.classList.contains('cursor-not-allowed')).toBe(false);
      }
      expect(hidden('checkout-hint')).toBe(true);
      expect(hidden('mobile-checkout-hint')).toBe(true);
      expect(text('cart-step-indicator')).toBe('Step 2 of 2');
      expect(byId('cart-step-subtitle').innerHTML).toContain('Step Two:');
    });

    it('an invalid form puts it all back to step one', async () => {
      await load([item()]);
      fulfillmentChanged('shipping', {}, true, false);
      fulfillmentChanged('shipping', {}, false, false);
      expect(btn().disabled).toBe(true);
      expect(hidden('checkout-hint')).toBe(false);
      expect(text('cart-step-indicator')).toBe('Step 1 of 2');
      expect(byId('cart-step-subtitle').innerHTML).toContain('Step One:');
    });

    it('only a literal true counts as valid', async () => {
      await load([item()]);
      fulfillmentChanged('shipping', {}, undefined, false);
      expect(btn().disabled).toBe(true);
    });

    it('recalculates the summary only when asked', async () => {
      chooseFulfillment('shipping');
      await load([item()]);
      fetchMock.mockClear();
      fulfillmentChanged('shipping', {}, true, false);
      await flush();
      expect(calls('/api/calculate-cart')).toHaveLength(0);
      fulfillmentChanged('shipping', {}, true, true);
      await flush();
      expect(calls('/api/calculate-cart')).toHaveLength(1);
    });

    it('catches up when the form was already confirmed before page-load wiring', async () => {
      byId('fulfillment-summary-chip').classList.remove('hidden');
      chooseFulfillment('pickup');
      await load([item()]);
      expect(btn().disabled).toBe(false);
      expect(text('cart-step-indicator')).toBe('Step 2 of 2');
    });

    it('does not catch up when the chip is hidden or nothing is chosen', async () => {
      chooseFulfillment('pickup');
      await load([item()]);
      expect(btn().disabled).toBe(true);
    });

    it('forgets a confirmed form on the next page-load', async () => {
      chooseFulfillment('shipping');
      await load([item()]);
      fillShipping();
      fulfillmentChanged('shipping', {}, true, false);
      document.dispatchEvent(new Event('astro:page-load'));
      await flush();
      fetchMock.mockClear();
      btn().click();
      await flush();
      expect(calls('/api/create-checkout')).toHaveLength(0);
    });
  });

  describe('checkout', () => {
    async function ready(
      method: 'shipping' | 'pickup' | null = 'shipping',
      items: CartItem[] = [item({ quantity: 2 })]
    ) {
      chooseFulfillment(method);
      await load(items);
      fulfillmentChanged(method ?? 'shipping', {}, true, false);
      fetchMock.mockClear();
    }
    const click = async (id = 'checkout-button') => {
      byId(id).click();
      await flush();
    };

    it.each(['checkout-button', 'mobile-checkout-button'])(
      'does nothing from %s while the form is not valid, even if the form is filled in',
      async (id) => {
        chooseFulfillment('shipping');
        await load([item()]);
        fillShipping();
        (byId(id) as HTMLButtonElement).disabled = false;
        await click(id);
        expect(calls('/api/create-checkout')).toHaveLength(0);
      }
    );

    it('sends the cart and the shipping address, then redirects', async () => {
      await ready('shipping');
      fillShipping();
      await click();
      const [call] = calls('/api/create-checkout');
      expect(call[1].method).toBe('POST');
      const body = bodyOf(call);
      expect(body.items).toEqual(state.items);
      expect(body.fulfillmentMethod).toBe('shipping');
      expect(body.shippingAddress).toEqual({
        name: 'Test Buyer',
        email: 'buyer@example.com',
        phone: '5559876543',
        street1: '123 Example St',
        street2: 'Apt 2',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        instructions: 'Leave at door',
      });
      expect(body.pickupContact).toBeUndefined();
      expect(typeof body.checkoutKey).toBe('string');
      expect(body.checkoutKey.length).toBeGreaterThan(10);
      expect(showNotification).toHaveBeenCalledWith(
        'Redirecting to checkout...',
        'success'
      );
      expect(hrefValue).toBe('https://pay.example.com/c/1');
    });

    it('leaves an empty second address line and instructions out', async () => {
      await ready('shipping');
      fillShipping({ 'shipping-address2': '', 'shipping-instructions': '' });
      await click();
      const body = bodyOf(calls('/api/create-checkout')[0]);
      expect(body.shippingAddress.street2).toBeUndefined();
      expect(body.shippingAddress.instructions).toBeUndefined();
    });

    it('the mobile button checks out too', async () => {
      await ready('shipping');
      fillShipping();
      await click('mobile-checkout-button');
      expect(calls('/api/create-checkout')).toHaveLength(1);
    });

    it('sends the pickup contact for pickup', async () => {
      await ready('pickup');
      fillPickup();
      await click();
      const body = bodyOf(calls('/api/create-checkout')[0]);
      expect(body.fulfillmentMethod).toBe('pickup');
      expect(body.pickupContact).toEqual({
        name: 'Pat Pickup',
        email: 'pat@example.com',
        phone: '5551112222',
        notes: 'After 5pm',
      });
      expect(body.shippingAddress).toBeUndefined();
    });

    it('refuses an empty cart', async () => {
      await ready('shipping');
      state.items = [];
      await click();
      expect(showNotification).toHaveBeenCalledWith(
        'Your cart is empty',
        'error'
      );
      expect(calls('/api/create-checkout')).toHaveLength(0);
    });

    it('asks for a fulfillment method when none is chosen', async () => {
      await ready('shipping');
      chooseFulfillment(null);
      await click();
      expect(showNotification).toHaveBeenCalledWith(
        'Please choose a fulfillment method',
        'error'
      );
      expect(expandForm).toHaveBeenCalled();
      expect(calls('/api/create-checkout')).toHaveLength(0);
    });

    it.each([
      'shipping-first-name',
      'shipping-last-name',
      'shipping-email',
      'shipping-phone',
      'shipping-address',
      'shipping-city',
      'shipping-state',
      'shipping-zip',
    ])('refuses shipping without %s and reopens the form', async (id) => {
      await ready('shipping');
      fillShipping({ [id]: '   ' });
      await click();
      expect(showNotification).toHaveBeenCalledWith(
        'Please fill in all required shipping fields',
        'error'
      );
      expect(expandForm).toHaveBeenCalled();
      expect(calls('/api/create-checkout')).toHaveLength(0);
    });

    it.each(['pickup-name', 'pickup-email', 'pickup-phone'])(
      'refuses pickup without %s and reopens the form',
      async (id) => {
        await ready('pickup');
        fillPickup();
        (byId(id) as HTMLInputElement).value = '';
        await click();
        expect(showNotification).toHaveBeenCalledWith(
          'Please fill in all required pickup fields',
          'error'
        );
        expect(expandForm).toHaveBeenCalled();
        expect(calls('/api/create-checkout')).toHaveLength(0);
      }
    );

    it('does not require the second address line or instructions', async () => {
      await ready('shipping');
      fillShipping({ 'shipping-address2': '', 'shipping-instructions': '' });
      await click();
      expect(calls('/api/create-checkout')).toHaveLength(1);
    });

    it('reports a missing shipping form', async () => {
      await ready('shipping');
      $('[data-shipping-form]').remove();
      await click();
      expect(showNotification).toHaveBeenCalledWith(
        'Shipping form not found',
        'error'
      );
    });

    it('reports a missing pickup form', async () => {
      await ready('pickup');
      $('[data-pickup-form]').remove();
      await click();
      expect(showNotification).toHaveBeenCalledWith(
        'Pick up form not found',
        'error'
      );
    });

    it('shows the server error when checkout is refused', async () => {
      await ready('shipping');
      fillShipping();
      handlers['/api/create-checkout'] = () =>
        jsonResponse({ error: 'Out of stock: Deck' }, false, 409);
      await click();
      expect(showNotification).toHaveBeenCalledWith(
        'Out of stock: Deck',
        'error'
      );
      expect(hrefValue).toBe('http://localhost/cart');
    });

    it('says "Checkout failed" when the refusal has no message', async () => {
      await ready('shipping');
      fillShipping();
      handlers['/api/create-checkout'] = () => jsonResponse({}, false, 500);
      await click();
      expect(showNotification).toHaveBeenCalledWith('Checkout failed', 'error');
    });

    it('does not redirect without a checkout URL', async () => {
      await ready('shipping');
      fillShipping();
      handlers['/api/create-checkout'] = () => jsonResponse({});
      await click();
      expect(showNotification).toHaveBeenCalledWith(
        'No checkout URL returned',
        'error'
      );
      expect(hrefValue).toBe('http://localhost/cart');
    });

    it('uses a generic message when the request throws a non-Error', async () => {
      await ready('shipping');
      fillShipping();
      handlers['/api/create-checkout'] = () => {
        throw 'nope';
      };
      await click();
      expect(showNotification).toHaveBeenCalledWith(
        'Checkout failed. Please try again.',
        'error'
      );
    });

    it('reconciles the cart when the server adjusted it', async () => {
      await ready('shipping');
      fillShipping();
      const adjusted = [item({ quantity: 1 })];
      handlers['/api/create-checkout'] = () =>
        jsonResponse({
          checkoutUrl: 'https://pay.example.com/c/2',
          cartUpdated: true,
          adjustedCart: adjusted,
        });
      await click();
      expect(cart.reconcileWithServerCart).toHaveBeenCalledWith(adjusted);
    });

    it('reconciles with an empty list when the server sent none', async () => {
      await ready('shipping');
      fillShipping();
      handlers['/api/create-checkout'] = () =>
        jsonResponse({
          checkoutUrl: 'https://pay.example.com/c/2',
          cartUpdated: true,
        });
      await click();
      expect(cart.reconcileWithServerCart).toHaveBeenCalledWith([]);
    });

    it('shows a stock message and waits three seconds before redirecting', async () => {
      await ready('shipping');
      fillShipping();
      handlers['/api/create-checkout'] = () =>
        jsonResponse({
          checkoutUrl: 'https://pay.example.com/c/3',
          stockMessage: 'Quantity reduced',
        });
      vi.useFakeTimers();
      byId('checkout-button').click();
      await vi.advanceTimersByTimeAsync(2999);
      expect(showNotification).toHaveBeenCalledWith(
        'Quantity reduced',
        'error'
      );
      expect(hrefValue).toBe('http://localhost/cart');
      await vi.advanceTimersByTimeAsync(1);
      expect(hrefValue).toBe('https://pay.example.com/c/3');
    });

    it('remembers the pending order id for the confirmation page', async () => {
      await ready('shipping');
      fillShipping();
      handlers['/api/create-checkout'] = () =>
        jsonResponse({
          checkoutUrl: 'https://pay.example.com/c/4',
          orderId: 'ORDER9',
        });
      await click();
      expect(sessionStorage.getItem('square-pending-orderId')).toBe('ORDER9');
    });

    it('stores nothing when there is no order id', async () => {
      await ready('shipping');
      fillShipping();
      await click();
      expect(sessionStorage.getItem('square-pending-orderId')).toBeNull();
    });

    it('shows the loading overlay during the request and hides it after', async () => {
      await ready('shipping');
      fillShipping();
      let release: (r: Response) => void = () => {};
      handlers['/api/create-checkout'] = () =>
        new Promise<Response>((r) => (release = r));
      byId('checkout-button').click();
      await flush();
      expect(hidden('loading-overlay')).toBe(false);
      expect(byId('loading-overlay').classList.contains('flex')).toBe(true);
      release(jsonResponse({ checkoutUrl: 'https://pay.example.com/c/5' }));
      await flush();
      expect(hidden('loading-overlay')).toBe(true);
      expect(byId('loading-overlay').classList.contains('flex')).toBe(false);
    });

    it('hides the overlay after a failure too', async () => {
      await ready('shipping');
      fillShipping();
      handlers['/api/create-checkout'] = () => jsonResponse({}, false, 500);
      await click();
      expect(hidden('loading-overlay')).toBe(true);
    });
  });

  describe('clear cart', () => {
    const click = async () => {
      byId('clear-cart-button').click();
      await flush();
    };

    it('says so when the cart is already empty', async () => {
      await load([item()]);
      state.items = [];
      await click();
      expect(showNotification).toHaveBeenCalledWith(
        'Cart is already empty',
        'error'
      );
    });

    it('asks through the site modal when there is one (single item)', async () => {
      const showModal = vi.fn();
      (window as unknown as Record<string, unknown>).showModal = showModal;
      await load([item()]);
      await click();
      expect(showModal).toHaveBeenCalledWith(
        'Remove Item',
        'Are you sure you want to remove "Deck 8.0" from your cart?',
        expect.any(Function),
        'Remove',
        'Cancel'
      );
    });

    it('words the question for several items by count', async () => {
      const showModal = vi.fn();
      (window as unknown as Record<string, unknown>).showModal = showModal;
      await load([item({ quantity: 2 }), item({ id: 'B', variationId: 'VB' })]);
      await click();
      expect(showModal).toHaveBeenCalledWith(
        'Clear Cart',
        'Are you sure you want to remove all 3 items from your cart?',
        expect.any(Function),
        'Remove',
        'Cancel'
      );
    });

    it('falls back to the browser confirm when there is no modal', async () => {
      const confirmFn = vi.fn(() => false);
      vi.stubGlobal('confirm', confirmFn);
      await load([item()]);
      await click();
      expect(confirmFn).toHaveBeenCalledWith(
        'Remove Item\n\nAre you sure you want to remove "Deck 8.0" from your cart?'
      );
      expect(cart.clear).not.toHaveBeenCalled();
    });

    it('does nothing when the browser confirm is declined', async () => {
      vi.stubGlobal('confirm', () => false);
      await load([item()]);
      await click();
      expect(cart.clear).not.toHaveBeenCalled();
    });

    it('confirming clears the cart, reopens step one and shows the empty state', async () => {
      vi.stubGlobal('confirm', () => true);
      await load([item({ quantity: 2 }), item({ id: 'B', variationId: 'VB' })]);
      await click();
      expect(cart.clear).toHaveBeenCalled();
      expect(expandForm).toHaveBeenCalled();
      expect(hidden('empty-cart')).toBe(false);
      expect(showNotification).toHaveBeenCalledWith(
        'Cart cleared',
        'success',
        10000,
        expect.objectContaining({ label: 'Undo' })
      );
    });

    it('names the item when a single item is removed', async () => {
      vi.stubGlobal('confirm', () => true);
      await load([item()]);
      await click();
      expect(showNotification).toHaveBeenCalledWith(
        '"Deck 8.0" removed',
        'success',
        10000,
        expect.objectContaining({ label: 'Undo' })
      );
    });

    it('Undo restores every item and says how many', async () => {
      vi.stubGlobal('confirm', () => true);
      await load([item(), item({ id: 'B', variationId: 'VB', title: 'Grip' })]);
      await click();
      const action = showNotification.mock.calls.at(-1)![3] as {
        onClick: () => Promise<void>;
      };
      await action.onClick();
      await flush();
      expect(cart.addItem).toHaveBeenCalledTimes(2);
      expect(showNotification).toHaveBeenLastCalledWith(
        '2 items restored',
        'success'
      );
      expect(document.querySelectorAll('[data-item-container]')).toHaveLength(
        2
      );
    });

    it('Undo of a single item names it', async () => {
      vi.stubGlobal('confirm', () => true);
      await load([item()]);
      await click();
      const action = showNotification.mock.calls.at(-1)![3] as {
        onClick: () => Promise<void>;
      };
      await action.onClick();
      await flush();
      expect(showNotification).toHaveBeenLastCalledWith(
        '"Deck 8.0" restored',
        'success'
      );
    });

    it('Undo reports a failure', async () => {
      vi.stubGlobal('confirm', () => true);
      await load([item()]);
      await click();
      const action = showNotification.mock.calls.at(-1)![3] as {
        onClick: () => Promise<void>;
      };
      cart.addItem.mockRejectedValueOnce(new Error('x'));
      await action.onClick();
      expect(showNotification).toHaveBeenLastCalledWith(
        'Could not restore cart items',
        'error'
      );
    });
  });

  describe('page-load', () => {
    it('re-renders on every page-load without adding listeners twice', async () => {
      await load([item()]);
      state.items = [item({ title: 'Wheels' })];
      document.dispatchEvent(new Event('astro:page-load'));
      await flush();
      expect($('[data-item-container]').textContent).toContain('Wheels');
      // one click must do one checkout, not one per page-load
      chooseFulfillment('shipping');
      fulfillmentChanged('shipping', {}, true, false);
      fillShipping();
      fetchMock.mockClear();
      byId('checkout-button').click();
      await flush();
      expect(calls('/api/create-checkout').length).toBeGreaterThanOrEqual(1);
    });

    it('ignores an update that starts while one is running', async () => {
      let release: (r: Response) => void = () => {};
      handlers['/api/cart-inventory'] = () =>
        new Promise<Response>((r) => (release = r));
      state.items = [item()];
      await freshInit();
      document.dispatchEvent(new Event('astro:page-load'));
      document.dispatchEvent(new Event('astro:page-load'));
      await flush();
      expect(calls('/api/cart-inventory')).toHaveLength(1);
      release(jsonResponse({ success: true, inventory: {} }));
      await flush();
    });

    it('gives up quietly when the cart markup is missing', async () => {
      document.body.innerHTML = '<div id="cart-loading"></div>';
      state.items = [item()];
      await freshInit();
      document.dispatchEvent(new Event('astro:page-load'));
      await flush();
      expect(byId('cart-loading').classList.contains('hidden')).toBe(false);
    });
  });
});
