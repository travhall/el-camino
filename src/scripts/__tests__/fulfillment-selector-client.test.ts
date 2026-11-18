/**
 * Characterization tests for fulfillment-selector-client (plan 228, extracted
 * from the inline script in FulfillmentSelector.astro). Each test does a fresh
 * `vi.resetModules()` + dynamic import because the module holds module-level
 * state (the `initialized` guard and the "page-load has happened" flag).
 *
 * The module registers listeners on `window` and `document` that outlive a
 * test, so every `addEventListener` call on them is recorded in `beforeEach`
 * and undone in `afterEach`; otherwise an earlier test's copy of the module
 * would also react to the events a later test dispatches.
 *
 * What this script owns: the shipping/pickup choice and its forms, the
 * free-shipping progress display, and the contract with the cart page,
 * `window.updateOrderSummaryOnFulfillmentChange(method, formData, formIsValid,
 * shouldRecalculate)`. The authoritative totals come from the server
 * (`calculate-cart`); nothing here computes an order total.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { getTotal, initFloatSelects } = vi.hoisted(() => ({
  getTotal: vi.fn(() => 0),
  initFloatSelects: vi.fn(),
}));

vi.mock('@/lib/cart', () => ({ cart: { getTotal } }));
vi.mock('@/lib/ui/floatFields', () => ({ initFloatSelects }));

type Recorded = {
  target: Window | Document;
  type: string;
  listener: EventListenerOrEventListenerObject;
};
let recorded: Recorded[] = [];

const STORAGE_KEY = 'fulfillment-form';
const updateOrderSummary = vi.fn();
const reportValidity = vi.fn(() => false);

function field(id: string, type = 'text'): string {
  return `<input type="${type}" id="${id}" name="${id}" value="">`;
}

function fixture(
  opts: {
    threshold?: string | null;
    flat?: string | null;
    costLabel?: string;
  } = {}
): string {
  const threshold =
    opts.threshold === null
      ? ''
      : ` data-free-shipping-threshold="${opts.threshold ?? '75'}"`;
  const flat =
    opts.flat === null
      ? ''
      : ` data-flat-rate-shipping="${opts.flat ?? '5.99'}"`;
  return `
    <div data-component="fulfillment-selector"${threshold}${flat}>
      <div id="fulfillment-summary-chip" class="hidden">
        <span id="fulfillment-summary-label"></span>
        <span id="fulfillment-summary-detail"></span>
        <button type="button" id="fulfillment-expand-btn" aria-expanded="false">Edit</button>
      </div>
      <input type="radio" name="fulfillment" id="fulfillment-shipping" value="shipping">
      <input type="radio" name="fulfillment" id="fulfillment-pickup" value="pickup">
      <div id="fulfillment-tab-row">
        <button type="button" data-tab="shipping" aria-pressed="false">Ship to Me <span data-shipping-cost-label>${opts.costLabel ?? '$5.99'}</span></button>
        <button type="button" data-tab="pickup" aria-pressed="false">Store Pick Up</button>
      </div>
      <div id="free-shipping-tracker" class="hidden">
        <span id="free-shipping-remaining"></span>
        <div id="free-shipping-progress" style="width: 0%"></div>
      </div>
      <div id="free-shipping-earned" class="hidden">You earned free shipping</div>
      <div id="fulfillment-form-panel" class="hidden">
        <div data-shipping-form class="hidden">
          ${field('shipping-first-name')}
          ${field('shipping-last-name')}
          ${field('shipping-email', 'email')}
          ${field('shipping-phone', 'tel')}
          ${field('shipping-address')}
          ${field('shipping-address2')}
          ${field('shipping-city')}
          <select id="shipping-state" name="shipping-state">
            <option value=""></option><option value="TX">TX</option><option value="WI">WI</option>
          </select>
          ${field('shipping-zip')}
          <textarea id="shipping-instructions"></textarea>
        </div>
        <div data-pickup-form class="hidden">
          ${field('pickup-name')}
          ${field('pickup-email', 'email')}
          ${field('pickup-phone', 'tel')}
          <textarea id="pickup-notes"></textarea>
        </div>
        <button type="button" id="fulfillment-done-btn" class="hidden"></button>
      </div>
    </div>
    <p id="gift-card-shipping-disclaimer" class="hidden">Gift cards ship free</p>`;
}

function setupDom(opts?: Parameters<typeof fixture>[0]): void {
  document.body.innerHTML = fixture(opts);
}

async function freshInit() {
  vi.resetModules();
  const mod = await import('../fulfillment-selector-client');
  mod.init();
  return mod;
}

function pageLoad(): void {
  document.dispatchEvent(new Event('astro:page-load'));
}

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector(selector) as T;
const input = (id: string) => document.getElementById(id) as HTMLInputElement;
const stateSelect = () =>
  document.getElementById('shipping-state') as HTMLSelectElement;
const hidden = (selector: string) => $(selector).classList.contains('hidden');
const tab = (method: string) => $(`[data-tab="${method}"]`);
const stored = () => JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');

function type(
  id: string,
  value: string,
  eventName: 'input' | 'change' = 'input'
) {
  const el = input(id);
  el.value = value;
  el.dispatchEvent(new Event(eventName, { bubbles: true }));
}

function fillShipping(overrides: Record<string, string> = {}): void {
  const values: Record<string, string> = {
    'shipping-first-name': 'Test',
    'shipping-last-name': 'Buyer',
    'shipping-email': 'buyer@example.com',
    'shipping-phone': '(555) 987-6543',
    'shipping-address': '123 Example St',
    'shipping-address2': 'Apt 2',
    'shipping-city': 'Austin',
    'shipping-state': 'TX',
    'shipping-zip': '78701',
    ...overrides,
  };
  for (const [id, value] of Object.entries(values)) input(id).value = value;
}

function fillPickup(): void {
  input('pickup-name').value = 'Pat Pickup';
  input('pickup-email').value = 'pat@example.com';
  input('pickup-phone').value = '(555) 111-2222';
}

/** The ids of the fields currently marked required inside a form. */
const requiredIds = (formSelector: string) =>
  [...document.querySelectorAll(`${formSelector} [required]`)].map((e) => e.id);

describe('fulfillment-selector-client', () => {
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
    getTotal.mockReset();
    getTotal.mockReturnValue(50);
    initFloatSelects.mockClear();
    updateOrderSummary.mockClear();
    reportValidity.mockClear();
    window.updateOrderSummaryOnFulfillmentChange = updateOrderSummary;
    window.scrollTo = vi.fn() as typeof window.scrollTo;
    HTMLElement.prototype.scrollIntoView = vi.fn();
    for (const proto of [
      HTMLInputElement.prototype,
      HTMLSelectElement.prototype,
    ]) {
      Object.defineProperty(proto, 'reportValidity', {
        value: reportValidity,
        configurable: true,
        writable: true,
      });
    }
    sessionStorage.clear();
    setupDom();
  });

  afterEach(() => {
    for (const { target, type, listener } of recorded) {
      target.removeEventListener(type, listener);
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete window.updateOrderSummaryOnFulfillmentChange;
    delete window.elco_expandFulfillmentForm;
    document.body.innerHTML = '';
  });

  describe('init', () => {
    it('registers page-load twice and cart:giftcard, in that order', async () => {
      await freshInit();

      expect(recorded.map((r) => r.type)).toEqual([
        'astro:page-load',
        'astro:page-load',
        'cart:giftcard',
      ]);
    });

    it('is guarded: a second init() registers nothing further', async () => {
      const mod = await freshInit();
      mod.init();

      expect(recorded).toHaveLength(3);
    });

    it('does nothing on a page without the selector', async () => {
      document.body.innerHTML = '<p>no checkout here</p>';
      await freshInit();

      expect(() => pageLoad()).not.toThrow();
      expect(window.elco_expandFulfillmentForm).toBeUndefined();
      expect(updateOrderSummary).not.toHaveBeenCalled();
    });

    it('exposes expandForm for the cart page', async () => {
      await freshInit();
      pageLoad();
      expect(typeof window.elco_expandFulfillmentForm).toBe('function');

      // Collapse first, then reopen through the exposed function.
      fillShipping();
      $('#fulfillment-done-btn').click();
      expect(hidden('#fulfillment-form-panel')).toBe(true);

      window.elco_expandFulfillmentForm!();

      expect(hidden('#fulfillment-form-panel')).toBe(false);
    });
  });

  describe('the default tab', () => {
    it('opens Ship to Me when nothing was saved, with its form, required fields and button', async () => {
      await freshInit();
      pageLoad();

      expect(input('fulfillment-shipping').checked).toBe(true);
      expect(tab('shipping').getAttribute('aria-pressed')).toBe('true');
      expect(tab('pickup').getAttribute('aria-pressed')).toBe('false');
      expect(hidden('#fulfillment-form-panel')).toBe(false);
      expect(hidden('[data-shipping-form]')).toBe(false);
      expect(hidden('[data-pickup-form]')).toBe(true);
      expect($('#fulfillment-done-btn').textContent).toBe(
        'Confirm : Ship to Me'
      );
      expect($('#fulfillment-done-btn').getAttribute('aria-label')).toBe(
        'Confirm Ship to Me and save details'
      );
      expect(hidden('#fulfillment-done-btn')).toBe(false);
      expect(requiredIds('[data-shipping-form]')).toEqual([
        'shipping-first-name',
        'shipping-last-name',
        'shipping-email',
        'shipping-phone',
        'shipping-address',
        'shipping-city',
        'shipping-state',
        'shipping-zip',
      ]);
      expect(requiredIds('[data-pickup-form]')).toEqual([]);
    });

    it('does not tell the cart page anything while opening by default', async () => {
      await freshInit();
      pageLoad();

      expect(updateOrderSummary).not.toHaveBeenCalled();
    });

    it('initialises the floating labels', async () => {
      await freshInit();
      pageLoad();

      expect(initFloatSelects).toHaveBeenCalledWith(
        $('[data-component="fulfillment-selector"]')
      );
    });
  });

  describe('switching tabs', () => {
    it('Store Pick Up shows its form, hides the shipping form and tracker, and swaps the required fields', async () => {
      await freshInit();
      pageLoad();

      tab('pickup').click();

      expect(input('fulfillment-pickup').checked).toBe(true);
      expect(tab('pickup').getAttribute('aria-pressed')).toBe('true');
      expect(tab('shipping').getAttribute('aria-pressed')).toBe('false');
      expect(hidden('[data-pickup-form]')).toBe(false);
      expect(hidden('[data-shipping-form]')).toBe(true);
      expect(hidden('#free-shipping-tracker')).toBe(true);
      expect(hidden('#free-shipping-earned')).toBe(true);
      expect($('#fulfillment-done-btn').textContent).toBe(
        'Confirm : Store Pick Up'
      );
      expect($('#fulfillment-done-btn').getAttribute('aria-label')).toBe(
        'Confirm Store Pick Up and save details'
      );
      expect(requiredIds('[data-pickup-form]')).toEqual([
        'pickup-name',
        'pickup-email',
        'pickup-phone',
      ]);
      expect(requiredIds('[data-shipping-form]')).toEqual([]);
      expect($('#fulfillment-summary-label').textContent).toBe(
        'Store Pick Up — FREE'
      );
    });

    it('tells the cart page the form is open and unconfirmed, and asks for a recalculation', async () => {
      await freshInit();
      pageLoad();
      input('pickup-name').value = 'Pat';

      tab('pickup').click();

      expect(updateOrderSummary).toHaveBeenCalledTimes(1);
      const [method, data, valid, recalc] = updateOrderSummary.mock.calls[0];
      expect(method).toBe('pickup');
      expect(data).toMatchObject({ method: 'pickup', 'pickup-name': 'Pat' });
      expect(valid).toBe(false);
      expect(recalc).toBe(true);
    });

    it('remembers the choice (unconfirmed) in session storage', async () => {
      await freshInit();
      pageLoad();

      tab('pickup').click();

      expect(stored()).toMatchObject({
        _method: 'pickup',
        _confirmed: 'false',
        method: 'pickup',
      });
    });

    it('coming back to Ship to Me brings the tracker back', async () => {
      await freshInit();
      pageLoad();
      tab('pickup').click();
      expect(hidden('#free-shipping-tracker')).toBe(true);

      tab('shipping').click();

      expect(hidden('#free-shipping-tracker')).toBe(false);
    });
  });

  describe('the free-shipping tracker', () => {
    it('below the threshold: shows what is left, the progress and the flat rate', async () => {
      getTotal.mockReturnValue(37.5);
      await freshInit();
      pageLoad();

      expect(hidden('#free-shipping-tracker')).toBe(false);
      expect(hidden('#free-shipping-earned')).toBe(true);
      expect($('#free-shipping-remaining').textContent).toBe('$37.50');
      expect($('#free-shipping-progress').style.width).toBe('50%');
      expect($('[data-shipping-cost-label]').textContent).toBe('$5.99');
    });

    it('at exactly the threshold shipping is free', async () => {
      getTotal.mockReturnValue(75);
      await freshInit();
      pageLoad();

      expect(hidden('#free-shipping-tracker')).toBe(true);
      expect(hidden('#free-shipping-earned')).toBe(false);
      expect($('[data-shipping-cost-label]').textContent).toBe('FREE');
    });

    it('a cent under the threshold still shows the tracker', async () => {
      getTotal.mockReturnValue(74.99);
      await freshInit();
      pageLoad();

      expect(hidden('#free-shipping-tracker')).toBe(false);
      expect($('#free-shipping-remaining').textContent).toBe('$0.01');
    });

    it('above the threshold shipping is free', async () => {
      getTotal.mockReturnValue(120);
      await freshInit();
      pageLoad();

      expect(hidden('#free-shipping-earned')).toBe(false);
      expect($('[data-shipping-cost-label]').textContent).toBe('FREE');
    });

    it('reads the threshold and flat rate from the component', async () => {
      setupDom({ threshold: '100', flat: '7.5' });
      getTotal.mockReturnValue(99);
      await freshInit();
      pageLoad();

      expect($('#free-shipping-remaining').textContent).toBe('$1.00');
      expect($('#free-shipping-progress').style.width).toBe('99%');
      expect($('[data-shipping-cost-label]').textContent).toBe('$7.50');

      getTotal.mockReturnValue(100);
      window.dispatchEvent(new Event('cartUpdated'));
      expect($('[data-shipping-cost-label]').textContent).toBe('FREE');
    });

    it('falls back to $75 and $5.99 when the component does not say', async () => {
      setupDom({ threshold: null, flat: null });
      getTotal.mockReturnValue(50);
      await freshInit();
      pageLoad();

      expect($('#free-shipping-remaining').textContent).toBe('$25.00');
      expect($('[data-shipping-cost-label]').textContent).toBe('$5.99');
    });

    it('follows the cart: cartUpdated re-syncs the tracker', async () => {
      await freshInit();
      pageLoad();
      expect($('#free-shipping-remaining').textContent).toBe('$25.00');

      getTotal.mockReturnValue(60);
      window.dispatchEvent(new Event('cartUpdated'));

      expect($('#free-shipping-remaining').textContent).toBe('$15.00');
    });

    it('is not shown for Store Pick Up, even below the threshold', async () => {
      await freshInit();
      pageLoad();
      tab('pickup').click();

      window.dispatchEvent(new Event('cartUpdated'));

      expect(hidden('#free-shipping-tracker')).toBe(true);
      expect(hidden('#free-shipping-earned')).toBe(true);
    });

    it('is not shown while the form is collapsed to its summary', async () => {
      await freshInit();
      pageLoad();
      fillShipping();
      $('#fulfillment-done-btn').click();

      window.dispatchEvent(new Event('cartUpdated'));

      expect(hidden('#free-shipping-tracker')).toBe(true);
      expect(hidden('#free-shipping-earned')).toBe(true);
    });
  });

  describe('confirming (the Done button)', () => {
    it('with an invalid required field, reports it, scrolls to it and does not collapse or save', async () => {
      await freshInit();
      pageLoad();
      fillShipping({ 'shipping-address': '' });

      $('#fulfillment-done-btn').click();

      expect(reportValidity).toHaveBeenCalledTimes(1);
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      });
      expect(hidden('#fulfillment-form-panel')).toBe(false);
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(updateOrderSummary).not.toHaveBeenCalled();
    });

    it('a valid shipping form is saved as confirmed and collapsed to a summary', async () => {
      await freshInit();
      pageLoad();
      fillShipping();

      $('#fulfillment-done-btn').click();

      expect(stored()).toMatchObject({
        _method: 'shipping',
        _confirmed: 'true',
        'shipping-first-name': 'Test',
        'shipping-state': 'TX',
        'shipping-zip': '78701',
      });
      expect(hidden('#fulfillment-form-panel')).toBe(true);
      expect($('#fulfillment-form-panel').getAttribute('aria-hidden')).toBe(
        'true'
      );
      expect(hidden('#fulfillment-tab-row')).toBe(true);
      expect(hidden('#fulfillment-done-btn')).toBe(true);
      expect(hidden('#free-shipping-tracker')).toBe(true);
      expect(hidden('#free-shipping-earned')).toBe(true);
      expect(hidden('#fulfillment-summary-chip')).toBe(false);
      expect($('#fulfillment-summary-chip').classList.contains('flex')).toBe(
        true
      );
      expect($('#fulfillment-expand-btn').getAttribute('aria-expanded')).toBe(
        'false'
      );
      expect($('#fulfillment-summary-label').textContent).toBe(
        'Ship to Me — $5.99'
      );
      expect($('#fulfillment-summary-detail').textContent).toBe(
        'Test Buyer · 123 Example St, Apt 2, Austin TX 78701'
      );
      expect(window.scrollTo).toHaveBeenCalledWith({
        top: 0,
        behavior: 'smooth',
      });
    });

    it('tells the cart page the form is confirmed and valid, with a recalculation', async () => {
      await freshInit();
      pageLoad();
      fillShipping();

      $('#fulfillment-done-btn').click();

      expect(updateOrderSummary).toHaveBeenCalledTimes(1);
      const [method, data, valid, recalc] = updateOrderSummary.mock.calls[0];
      expect(method).toBe('shipping');
      expect(data).toMatchObject({
        method: 'shipping',
        'shipping-city': 'Austin',
        'shipping-state': 'TX',
      });
      expect(valid).toBe(true);
      expect(recalc).toBe(true);
    });

    it('the summary says FREE once the cart qualifies', async () => {
      getTotal.mockReturnValue(90);
      await freshInit();
      pageLoad();
      fillShipping();

      $('#fulfillment-done-btn').click();

      expect($('#fulfillment-summary-label').textContent).toBe(
        'Ship to Me — FREE'
      );
    });

    it('the summary falls back to $5.99 when the cost label is empty', async () => {
      getTotal.mockReturnValue(90);
      await freshInit();
      pageLoad();
      $('[data-shipping-cost-label]').textContent = '';
      fillShipping();

      $('#fulfillment-done-btn').click();

      expect($('#fulfillment-summary-label').textContent).toBe(
        'Ship to Me — $5.99'
      );
    });

    it('the shipping summary leaves out an empty second address line', async () => {
      await freshInit();
      pageLoad();
      fillShipping({ 'shipping-address2': '' });

      $('#fulfillment-done-btn').click();

      expect($('#fulfillment-summary-detail').textContent).toBe(
        'Test Buyer · 123 Example St, Austin TX 78701'
      );
    });

    it('a restored confirmed save is summarised without re-validating, leaving out whatever is empty', async () => {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          _method: 'shipping',
          _confirmed: 'true',
          'shipping-first-name': 'Test',
          'shipping-address': '123 Example St',
          'shipping-city': 'Austin',
          'shipping-zip': '78701',
        })
      );
      await freshInit();
      pageLoad();

      expect(hidden('#fulfillment-form-panel')).toBe(true);
      expect($('#fulfillment-summary-detail').textContent).toBe(
        'Test · 123 Example St, Austin 78701'
      );
    });

    it('a valid pickup form collapses to its summary', async () => {
      await freshInit();
      pageLoad();
      tab('pickup').click();
      updateOrderSummary.mockClear();
      fillPickup();

      $('#fulfillment-done-btn').click();

      expect(stored()).toMatchObject({
        _method: 'pickup',
        _confirmed: 'true',
        'pickup-name': 'Pat Pickup',
      });
      expect($('#fulfillment-summary-label').textContent).toBe(
        'Store Pick Up — FREE'
      );
      expect($('#fulfillment-summary-detail').textContent).toBe(
        'Pat Pickup · pat@example.com'
      );
      expect(updateOrderSummary).toHaveBeenCalledWith(
        'pickup',
        expect.objectContaining({ method: 'pickup' }),
        true,
        true
      );
    });
  });

  describe('editing again (expand)', () => {
    async function collapsed() {
      await freshInit();
      pageLoad();
      fillShipping();
      $('#fulfillment-done-btn').click();
      updateOrderSummary.mockClear();
    }

    it('reopens the form and the tabs, hides the summary and restores the tracker', async () => {
      await collapsed();

      $('#fulfillment-expand-btn').click();

      expect(hidden('#fulfillment-form-panel')).toBe(false);
      expect($('#fulfillment-form-panel').hasAttribute('aria-hidden')).toBe(
        false
      );
      expect(hidden('#fulfillment-tab-row')).toBe(false);
      expect(hidden('#fulfillment-summary-chip')).toBe(true);
      expect($('#fulfillment-summary-chip').classList.contains('flex')).toBe(
        false
      );
      expect($('#fulfillment-expand-btn').getAttribute('aria-expanded')).toBe(
        'true'
      );
      expect(hidden('#fulfillment-done-btn')).toBe(false);
      expect(hidden('#free-shipping-tracker')).toBe(false);
    });

    it('tells the cart page the form is open again and unconfirmed, without recalculating', async () => {
      await collapsed();

      $('#fulfillment-expand-btn').click();

      expect(updateOrderSummary).toHaveBeenCalledTimes(1);
      const [method, , valid, recalc] = updateOrderSummary.mock.calls[0];
      expect(method).toBe('shipping');
      expect(valid).toBe(false);
      expect(recalc).toBe(false);
    });
  });

  describe('keeping the form as the shopper types', () => {
    it('saves on every input and change, and tells the cart page it is still unconfirmed', async () => {
      await freshInit();
      pageLoad();

      type('shipping-first-name', 'Test', 'input');
      expect(stored()).toMatchObject({
        _method: 'shipping',
        _confirmed: 'false',
        'shipping-first-name': 'Test',
      });
      expect(updateOrderSummary).toHaveBeenLastCalledWith(
        'shipping',
        expect.objectContaining({ 'shipping-first-name': 'Test' }),
        false,
        false
      );

      updateOrderSummary.mockClear();
      type('shipping-last-name', 'Buyer', 'change');
      expect(stored()).toMatchObject({ 'shipping-last-name': 'Buyer' });
      expect(updateOrderSummary).toHaveBeenCalledTimes(1);
    });

    it('only collects the fields of the active form', async () => {
      await freshInit();
      pageLoad();
      input('pickup-name').value = 'Not this one';

      type('shipping-city', 'Austin');

      expect(stored()['pickup-name']).toBeUndefined();
      expect(stored()['shipping-city']).toBe('Austin');
    });
  });

  describe('coming back to the page (restoring the form)', () => {
    it('an unconfirmed save reopens the form with its values and leaves it open', async () => {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          _method: 'pickup',
          _confirmed: 'false',
          'pickup-name': 'Pat',
          'pickup-email': 'pat@example.com',
        })
      );
      await freshInit();
      pageLoad();

      expect(input('fulfillment-pickup').checked).toBe(true);
      expect(input('pickup-name').value).toBe('Pat');
      expect(input('pickup-email').value).toBe('pat@example.com');
      expect(hidden('#fulfillment-form-panel')).toBe(false);
      expect(hidden('#fulfillment-summary-chip')).toBe(true);
      expect(initFloatSelects).toHaveBeenCalled();
    });

    it('a confirmed save collapses straight to its summary and tells the cart page', async () => {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          _method: 'pickup',
          _confirmed: 'true',
          'pickup-name': 'Pat',
          'pickup-email': 'pat@example.com',
        })
      );
      await freshInit();
      pageLoad();

      expect(hidden('#fulfillment-form-panel')).toBe(true);
      expect($('#fulfillment-summary-detail').textContent).toBe(
        'Pat · pat@example.com'
      );
      expect(updateOrderSummary).toHaveBeenCalledWith(
        'pickup',
        expect.objectContaining({ 'pickup-name': 'Pat' }),
        true,
        true
      );
    });

    it('restores a shipping save, including the state select', async () => {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          _method: 'shipping',
          _confirmed: 'false',
          'shipping-city': 'Madison',
          'shipping-state': 'WI',
        })
      );
      await freshInit();
      pageLoad();

      expect(input('shipping-city').value).toBe('Madison');
      expect(stateSelect().value).toBe('WI');
    });

    it('discards a save that cannot be read and opens the default tab', async () => {
      sessionStorage.setItem(STORAGE_KEY, '{not json');
      await freshInit();
      pageLoad();

      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(input('fulfillment-shipping').checked).toBe(true);
    });

    it('ignores a save with an unknown method', async () => {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ _method: 'drone', _confirmed: 'true' })
      );
      await freshInit();
      pageLoad();

      expect(input('fulfillment-shipping').checked).toBe(true);
      expect(hidden('#fulfillment-form-panel')).toBe(false);
    });
  });

  describe('phone masking', () => {
    it.each([
      ['', ''],
      ['7', '(7'],
      ['715', '(715'],
      ['7155', '(715) 5'],
      ['715555', '(715) 555'],
      ['7155551234', '(715) 555-1234'],
      ['(715) 555-1234', '(715) 555-1234'],
      ['1 715 555 1234', '(715) 555-1234'],
      ['abc715x', '(715'],
      ['71555512345', '(715) 555-1234'],
    ])('formats %j as %j', async (typed, expected) => {
      await freshInit();
      pageLoad();

      type('shipping-phone', typed);

      expect(input('shipping-phone').value).toBe(expected);
    });

    it('masks on change as well, and on the pickup phone', async () => {
      await freshInit();
      pageLoad();

      type('pickup-phone', '7155551234', 'change');

      expect(input('pickup-phone').value).toBe('(715) 555-1234');
    });
  });

  describe('ZIP code', () => {
    function stubZip(response: {
      ok?: boolean;
      places?: Array<Record<string, string>>;
    }) {
      const fetchMock = vi.fn(() =>
        Promise.resolve({
          ok: response.ok ?? true,
          json: () => Promise.resolve({ places: response.places }),
        })
      );
      vi.stubGlobal('fetch', fetchMock);
      return fetchMock;
    }
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    const blurZip = async () => {
      input('shipping-zip').dispatchEvent(new Event('blur'));
      await flush();
    };

    it('keeps digits only, at most five', async () => {
      await freshInit();
      pageLoad();

      type('shipping-zip', '78-701ab99');

      expect(input('shipping-zip').value).toBe('78701');
    });

    it('does not look anything up until it has five digits', async () => {
      const fetchMock = stubZip({});
      await freshInit();
      pageLoad();
      input('shipping-zip').value = '787';

      await blurZip();

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fills an empty city and state from the ZIP, saves and notifies', async () => {
      const fetchMock = stubZip({
        places: [{ 'place name': 'Austin', 'state abbreviation': 'TX' }],
      });
      await freshInit();
      pageLoad();
      input('shipping-zip').value = '78701';
      initFloatSelects.mockClear();
      updateOrderSummary.mockClear();

      await blurZip();

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.zippopotam.us/us/78701'
      );
      expect(input('shipping-city').value).toBe('Austin');
      expect(stateSelect().value).toBe('TX');
      expect(initFloatSelects).toHaveBeenCalled();
      expect(stored()).toMatchObject({
        'shipping-city': 'Austin',
        'shipping-state': 'TX',
      });
      expect(updateOrderSummary).toHaveBeenCalled();
    });

    it('never overwrites a city or state the shopper already chose', async () => {
      stubZip({
        places: [{ 'place name': 'Austin', 'state abbreviation': 'TX' }],
      });
      await freshInit();
      pageLoad();
      input('shipping-zip').value = '78701';
      input('shipping-city').value = 'Madison';
      stateSelect().value = 'WI';

      await blurZip();

      expect(input('shipping-city').value).toBe('Madison');
      expect(stateSelect().value).toBe('WI');
    });

    it.each([
      ['an error response', { ok: false }],
      ['a response with no places', { places: [] }],
      ['a response with no place list', {}],
    ])('stays silent on %s', async (_name, response) => {
      stubZip(response);
      await freshInit();
      pageLoad();
      input('shipping-zip').value = '78701';

      await blurZip();

      expect(input('shipping-city').value).toBe('');
    });

    it('stays silent when the lookup fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('offline')))
      );
      await freshInit();
      pageLoad();
      input('shipping-zip').value = '78701';

      await expect(blurZip()).resolves.toBeUndefined();

      expect(input('shipping-city').value).toBe('');
    });
  });

  describe('gift cards (cart:giftcard)', () => {
    const giftCard = (hasGiftCard: boolean) =>
      document.dispatchEvent(
        new CustomEvent('cart:giftcard', { detail: { hasGiftCard } })
      );

    it('shows the shipping disclaimer only while the cart has a gift card', async () => {
      await freshInit();
      pageLoad();

      giftCard(true);
      expect(hidden('#gift-card-shipping-disclaimer')).toBe(false);

      giftCard(false);
      expect(hidden('#gift-card-shipping-disclaimer')).toBe(true);
    });

    it('with a gift card and no choice made yet, moves focus to Store Pick Up', async () => {
      await freshInit();
      pageLoad();
      // Nothing chosen: the default tab opening is not a choice by the shopper.
      tab('shipping').setAttribute('aria-pressed', 'false');
      tab('pickup').setAttribute('aria-pressed', 'false');

      giftCard(true);

      expect(document.activeElement).toBe(tab('pickup'));
    });

    it('does not steal focus when a tab is already chosen', async () => {
      await freshInit();
      pageLoad();

      giftCard(true);

      expect(document.activeElement).not.toBe(tab('pickup'));
    });

    it('does not steal focus when a form was saved', async () => {
      await freshInit();
      pageLoad();
      tab('shipping').setAttribute('aria-pressed', 'false');
      tab('pickup').setAttribute('aria-pressed', 'false');
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ _method: 'pickup' })
      );

      giftCard(true);

      expect(document.activeElement).not.toBe(tab('pickup'));
    });

    it('does not move focus before the page has loaded', async () => {
      await freshInit();

      giftCard(true);

      expect(hidden('#gift-card-shipping-disclaimer')).toBe(false);
      expect(document.activeElement).not.toBe(tab('pickup'));
    });
  });

  describe('lifecycle', () => {
    it('a page-load after a swap sets up the new page', async () => {
      await freshInit();
      pageLoad();

      setupDom();
      getTotal.mockReturnValue(60);
      pageLoad();

      expect(input('fulfillment-shipping').checked).toBe(true);
      expect($('#free-shipping-remaining').textContent).toBe('$15.00');
      tab('pickup').click();
      expect(input('fulfillment-pickup').checked).toBe(true);
    });
  });
});
