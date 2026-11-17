/**
 * Characterization tests for modal-client (plan 181 PoC extraction from
 * Modal.astro). Each test does a fresh `vi.resetModules()` + dynamic import
 * because the module holds module-level singleton state (the `initialized`
 * guard and `modalManager`) that must not leak across tests.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EVENTS } from '@/lib/events';

function setupDom(siteConfig?: Record<string, unknown>): void {
  document.body.innerHTML = `
    <div id="modal-backdrop" style="display: none;">
      <div id="modal-panel"></div>
    </div>
    <div data-site-config='${JSON.stringify(
      siteConfig ?? {
        name: 'El Camino Skate Shop',
        tagline: '100% Skater Owned',
        contact: {
          address: {
            street: '310 Water St',
            city: 'Eau Claire',
            state: 'WI',
            zip: '54703',
          },
          phone: { number: '17159121169', display: '(715) 912-1169' },
          email: 'elco@elcaminoskateshop.com',
        },
        hours: [{ day: 'Monday', hours: 'Closed', isOpen: false }],
        social: [],
      }
    )}'></div>
  `;
}

async function freshInit() {
  vi.resetModules();
  const mod = await import('../modal-client');
  mod.init();
  return mod;
}

describe('modal-client', () => {
  beforeEach(() => {
    setupDom();
    vi.useRealTimers();
  });

  it('registers window.showModal on init', async () => {
    await freshInit();
    expect(typeof window.showModal).toBe('function');
  });

  it('opens the location modal with the parsed site config on SHOW_LOCATION_MODAL', async () => {
    await freshInit();
    document.dispatchEvent(new CustomEvent(EVENTS.SHOW_LOCATION_MODAL));

    const backdrop = document.getElementById('modal-backdrop') as HTMLElement;
    const panel = document.getElementById('modal-panel') as HTMLElement;
    expect(backdrop.style.display).toBe('');
    expect(panel.innerHTML).toContain('El Camino Skate Shop');
    expect(panel.innerHTML).toContain('310 Water St');
  });

  it('opens the secure checkout modal with contact info on SHOW_SECURE_CHECKOUT_MODAL', async () => {
    await freshInit();
    document.dispatchEvent(new CustomEvent(EVENTS.SHOW_SECURE_CHECKOUT_MODAL));

    const panel = document.getElementById('modal-panel') as HTMLElement;
    expect(panel.innerHTML).toContain('Secure Checkout');
    expect(panel.innerHTML).toContain('elco@elcaminoskateshop.com');
  });

  it('showModal renders the confirm dialog and invokes onConfirm on click', async () => {
    await freshInit();
    const onConfirm = vi.fn();
    window.showModal('Delete?', 'Are you sure?', onConfirm);

    const panel = document.getElementById('modal-panel') as HTMLElement;
    expect(panel.innerHTML).toContain('Delete?');

    const confirmButton = panel.querySelector(
      '#modal-confirm'
    ) as HTMLButtonElement;
    confirmButton.click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closeModal (via Escape) clears the panel after the close animation', async () => {
    vi.useFakeTimers();
    await freshInit();
    document.dispatchEvent(new CustomEvent(EVENTS.SHOW_LOCATION_MODAL));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    vi.advanceTimersByTime(300);

    const backdrop = document.getElementById('modal-backdrop') as HTMLElement;
    const panel = document.getElementById('modal-panel') as HTMLElement;
    expect(backdrop.style.display).toBe('none');
    expect(panel.innerHTML).toBe('');
    vi.useRealTimers();
  });

  it('astro:before-swap tears down listeners so a stale dispatch after swap is a no-op', async () => {
    await freshInit();
    document.dispatchEvent(new Event('astro:before-swap'));

    document.dispatchEvent(new CustomEvent(EVENTS.SHOW_LOCATION_MODAL));

    const backdrop = document.getElementById('modal-backdrop') as HTMLElement;
    expect(backdrop.style.display).toBe('none');
  });

  it('astro:page-load re-registers listeners after a swap (navigation lifecycle)', async () => {
    await freshInit();
    document.dispatchEvent(new Event('astro:before-swap'));
    document.dispatchEvent(new Event('astro:page-load'));

    document.dispatchEvent(new CustomEvent(EVENTS.SHOW_LOCATION_MODAL));

    const backdrop = document.getElementById('modal-backdrop') as HTMLElement;
    expect(backdrop.style.display).toBe('');
  });

  it('init() is idempotent: a second call does not stack a second page-load listener', async () => {
    const add = vi.spyOn(document, 'addEventListener');
    const mod = await freshInit();
    mod.init();
    const pageLoadRegistrations = add.mock.calls.filter(
      ([type]) => type === 'astro:page-load'
    );
    expect(pageLoadRegistrations).toHaveLength(1);
    add.mockRestore();
  });
});
