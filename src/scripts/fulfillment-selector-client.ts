import { cart } from '@/lib/cart';
import { initFloatSelects } from '@/lib/ui/floatFields';

declare global {
  interface Window {
    updateOrderSummaryOnFulfillmentChange?: (
      method: string,
      formData: Record<string, string>,
      formIsValid: boolean,
      shouldRecalculate?: boolean
    ) => void;
    elco_expandFulfillmentForm?: () => void;
  }
}

function initFulfillmentSelector() {
  const selector = document.querySelector(
    '[data-component="fulfillment-selector"]'
  );
  if (!selector) return;

  const FREE_SHIPPING_THRESHOLD =
    Number((selector as HTMLElement).dataset.freeShippingThreshold) || 75;
  const FLAT_RATE_SHIPPING =
    Number((selector as HTMLElement).dataset.flatRateShipping) || 5.99;

  const shippingRadio = selector.querySelector<HTMLInputElement>(
    '#fulfillment-shipping'
  );
  const pickupRadio = selector.querySelector<HTMLInputElement>(
    '#fulfillment-pickup'
  );
  const formPanel = selector.querySelector<HTMLElement>(
    '#fulfillment-form-panel'
  );
  const shippingForm = selector.querySelector<HTMLElement>(
    '[data-shipping-form]'
  );
  const pickupForm = selector.querySelector<HTMLElement>('[data-pickup-form]');
  const tabs = selector.querySelectorAll<HTMLButtonElement>('[data-tab]');
  const summaryChip = selector.querySelector<HTMLElement>(
    '#fulfillment-summary-chip'
  );
  const summaryLabel = selector.querySelector<HTMLElement>(
    '#fulfillment-summary-label'
  );
  const summaryDetail = selector.querySelector<HTMLElement>(
    '#fulfillment-summary-detail'
  );
  const expandBtn = selector.querySelector<HTMLButtonElement>(
    '#fulfillment-expand-btn'
  );
  const doneBtn = selector.querySelector<HTMLButtonElement>(
    '#fulfillment-done-btn'
  );
  const tabRow = selector.querySelector<HTMLElement>('#fulfillment-tab-row');

  function getSummaryLabel(method: 'shipping' | 'pickup'): string {
    if (method === 'shipping') {
      const costLabel = selector?.querySelector<HTMLElement>(
        '[data-shipping-cost-label]'
      );
      const cost = costLabel?.textContent?.trim() || '$5.99';
      return `Ship to Me — ${cost}`;
    }
    return 'Store Pick Up — FREE';
  }

  function collapseForm(method: 'shipping' | 'pickup') {
    formPanel?.classList.add('hidden');
    formPanel?.setAttribute('aria-hidden', 'true');
    tabRow?.classList.add('hidden');
    doneBtn?.classList.add('hidden');
    selector
      ?.querySelector<HTMLElement>('#free-shipping-tracker')
      ?.classList.add('hidden');
    selector
      ?.querySelector<HTMLElement>('#free-shipping-earned')
      ?.classList.add('hidden');
    if (summaryLabel) summaryLabel.textContent = getSummaryLabel(method);

    if (summaryDetail) {
      if (method === 'shipping') {
        const firstName =
          (document.getElementById('shipping-first-name') as HTMLInputElement)
            ?.value ?? '';
        const lastName =
          (document.getElementById('shipping-last-name') as HTMLInputElement)
            ?.value ?? '';
        const address =
          (document.getElementById('shipping-address') as HTMLInputElement)
            ?.value ?? '';
        const address2 =
          (document.getElementById('shipping-address2') as HTMLInputElement)
            ?.value ?? '';
        const city =
          (document.getElementById('shipping-city') as HTMLInputElement)
            ?.value ?? '';
        const state =
          (document.getElementById('shipping-state') as HTMLSelectElement)
            ?.value ?? '';
        const zip =
          (document.getElementById('shipping-zip') as HTMLInputElement)
            ?.value ?? '';
        const name = [firstName, lastName].filter(Boolean).join(' ');
        const street = [address, address2].filter(Boolean).join(', ');
        const cityLine = [city, state, zip].filter(Boolean).join(' ');
        summaryDetail.textContent = [
          name,
          [street, cityLine].filter(Boolean).join(', '),
        ]
          .filter(Boolean)
          .join(' · ');
      } else {
        const name =
          (document.getElementById('pickup-name') as HTMLInputElement)?.value ??
          '';
        const email =
          (document.getElementById('pickup-email') as HTMLInputElement)
            ?.value ?? '';
        summaryDetail.textContent = [name, email].filter(Boolean).join(' · ');
      }
    }

    summaryChip?.classList.remove('hidden');
    summaryChip?.classList.add('flex');
    expandBtn?.setAttribute('aria-expanded', 'false');

    if (typeof window.updateOrderSummaryOnFulfillmentChange === 'function') {
      window.updateOrderSummaryOnFulfillmentChange(
        method,
        getFormData(method),
        true,
        true
      );
    }
  }

  function expandForm() {
    formPanel?.classList.remove('hidden');
    formPanel?.removeAttribute('aria-hidden');
    tabRow?.classList.remove('hidden');
    summaryChip?.classList.add('hidden');
    summaryChip?.classList.remove('flex');
    expandBtn?.setAttribute('aria-expanded', 'true');
    const checkedRadio = selector?.querySelector<HTMLInputElement>(
      'input[name="fulfillment"]:checked'
    );
    if (checkedRadio) doneBtn?.classList.remove('hidden');

    // Restore free shipping tracker if shipping is the active method
    // (collapseForm hides it; expandForm must bring it back)
    updateFreeShippingTracker(cart.getTotal());

    // Notify cart that form is now open/unconfirmed — disable CTA
    if (
      checkedRadio &&
      typeof window.updateOrderSummaryOnFulfillmentChange === 'function'
    ) {
      const m = checkedRadio.value as 'shipping' | 'pickup';
      window.updateOrderSummaryOnFulfillmentChange(
        m,
        getFormData(m),
        false,
        false
      );
    }
  }

  // Expose expandForm so cart.astro can call it when "Edit" is clicked from Step 2
  window.elco_expandFulfillmentForm = expandForm;

  function getFormData(method: 'shipping' | 'pickup'): Record<string, string> {
    const form = method === 'shipping' ? shippingForm : pickupForm;
    const data: Record<string, string> = { method };
    form
      ?.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >('input, select, textarea')
      .forEach((el) => {
        if (el.id) data[el.id] = el.value;
      });
    return data;
  }

  function saveForm(confirmed = false) {
    const checkedRadio = selector?.querySelector<HTMLInputElement>(
      'input[name="fulfillment"]:checked'
    );
    if (!checkedRadio) return;
    const method = checkedRadio.value as 'shipping' | 'pickup';
    const data = getFormData(method);
    data._method = method;
    data._confirmed = String(confirmed);
    sessionStorage.setItem('fulfillment-form', JSON.stringify(data));
  }

  function notifyValidity() {
    const checkedRadio = selector?.querySelector<HTMLInputElement>(
      'input[name="fulfillment"]:checked'
    );
    if (!checkedRadio) return;
    const m = checkedRadio.value as 'shipping' | 'pickup';
    if (typeof window.updateOrderSummaryOnFulfillmentChange === 'function') {
      // Form panel is open — keep CTA disabled; only collapseForm() enables it
      window.updateOrderSummaryOnFulfillmentChange(
        m,
        getFormData(m),
        false,
        false
      );
    }
  }

  function setRequiredFields(method: 'shipping' | 'pickup') {
    selector
      ?.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(
        '[data-shipping-form] input, [data-shipping-form] select, [data-pickup-form] input'
      )
      .forEach((el) => el.removeAttribute('required'));

    if (method === 'shipping') {
      [
        'shipping-first-name',
        'shipping-last-name',
        'shipping-email',
        'shipping-phone',
        'shipping-address',
        'shipping-city',
        'shipping-state',
        'shipping-zip',
      ].forEach((id) => {
        selector?.querySelector(`#${id}`)?.setAttribute('required', '');
      });
    } else {
      ['pickup-name', 'pickup-email', 'pickup-phone'].forEach((id) => {
        selector?.querySelector(`#${id}`)?.setAttribute('required', '');
      });
    }
  }

  function updateFreeShippingTracker(subtotal: number) {
    const tracker = selector?.querySelector<HTMLElement>(
      '#free-shipping-tracker'
    );
    const remaining = selector?.querySelector<HTMLElement>(
      '#free-shipping-remaining'
    );
    const progress = selector?.querySelector<HTMLElement>(
      '#free-shipping-progress'
    );
    const earned = selector?.querySelector<HTMLElement>(
      '#free-shipping-earned'
    );
    const costLabel = selector?.querySelector<HTMLElement>(
      '[data-shipping-cost-label]'
    );

    // Tracker only appears when shipping tab is active AND form is expanded (not collapsed to chip)
    if (!shippingRadio?.checked || formPanel?.classList.contains('hidden')) {
      tracker?.classList.add('hidden');
      earned?.classList.add('hidden');
      return;
    }

    if (subtotal >= FREE_SHIPPING_THRESHOLD) {
      tracker?.classList.add('hidden');
      earned?.classList.remove('hidden');
      if (costLabel) costLabel.textContent = 'FREE';
    } else {
      tracker?.classList.remove('hidden');
      earned?.classList.add('hidden');
      const remainingAmt = FREE_SHIPPING_THRESHOLD - subtotal;
      if (remaining) {
        remaining.textContent = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(remainingAmt);
      }
      if (progress) {
        progress.style.width = `${Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100)}%`;
      }
      if (costLabel) {
        costLabel.textContent = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(FLAT_RATE_SHIPPING);
      }
    }
  }

  function handleTabClick(method: 'shipping' | 'pickup', triggerUpdate = true) {
    if (method === 'shipping' && shippingRadio) shippingRadio.checked = true;
    if (method === 'pickup' && pickupRadio) pickupRadio.checked = true;

    tabs.forEach((tab) => {
      tab.setAttribute('aria-pressed', String(tab.dataset.tab === method));
    });

    formPanel?.classList.remove('hidden');
    formPanel?.removeAttribute('aria-hidden');
    summaryChip?.classList.add('hidden');
    summaryChip?.classList.remove('flex');

    if (doneBtn) {
      doneBtn.classList.remove('hidden');
      doneBtn.textContent =
        method === 'shipping'
          ? 'Confirm : Ship to Me'
          : 'Confirm : Store Pick Up';
      doneBtn.setAttribute(
        'aria-label',
        method === 'shipping'
          ? 'Confirm Ship to Me and save details'
          : 'Confirm Store Pick Up and save details'
      );
    }

    if (summaryLabel && summaryChip) {
      summaryLabel.textContent = getSummaryLabel(method);
    }

    if (method === 'shipping') {
      shippingForm?.classList.remove('hidden');
      pickupForm?.classList.add('hidden');
      // Show free shipping tracker for shipping method
      updateFreeShippingTracker(cart.getTotal());
    } else {
      pickupForm?.classList.remove('hidden');
      shippingForm?.classList.add('hidden');
      // Hide free shipping tracker for pickup
      selector
        ?.querySelector<HTMLElement>('#free-shipping-tracker')
        ?.classList.add('hidden');
      selector
        ?.querySelector<HTMLElement>('#free-shipping-earned')
        ?.classList.add('hidden');
    }

    setRequiredFields(method);

    if (
      triggerUpdate &&
      typeof window.updateOrderSummaryOnFulfillmentChange === 'function'
    ) {
      // Form panel is open during a tab click — always unconfirmed, pass false
      window.updateOrderSummaryOnFulfillmentChange(
        method,
        getFormData(method),
        false,
        true
      );
    }
  }

  // Done button — validate then collapse
  doneBtn?.addEventListener('click', () => {
    const checkedRadio = selector?.querySelector<HTMLInputElement>(
      'input[name="fulfillment"]:checked'
    );
    if (!checkedRadio) return;
    const method = checkedRadio.value as 'shipping' | 'pickup';
    const activeForm = method === 'shipping' ? shippingForm : pickupForm;
    const requiredFields = activeForm?.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >('[required]');
    let firstInvalid:
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null = null;
    requiredFields?.forEach((field) => {
      if (!field.validity.valid && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) {
      (firstInvalid as HTMLInputElement).reportValidity();
      (firstInvalid as HTMLInputElement).scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }
    saveForm(true);
    collapseForm(method);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  expandBtn?.addEventListener('click', expandForm);

  function restoreForm() {
    const raw = sessionStorage.getItem('fulfillment-form');
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as Record<string, string>;
      const method = data._method as 'shipping' | 'pickup';
      if (method === 'shipping' || method === 'pickup') {
        handleTabClick(method, false);
        const form = method === 'shipping' ? shippingForm : pickupForm;
        form
          ?.querySelectorAll<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
          >('input, select, textarea')
          .forEach((el) => {
            if (el.id && data[el.id] !== undefined) el.value = data[el.id];
          });

        initFloatSelects(selector as Element);

        // Only collapse to chip if the user had previously clicked Confirm
        const wasConfirmed = data._confirmed === 'true';
        if (wasConfirmed) collapseForm(method);
      }
    } catch {
      sessionStorage.removeItem('fulfillment-form');
    }
  }

  // Wire up tab clicks
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const method = tab.dataset.tab as 'shipping' | 'pickup';
      handleTabClick(method);
      saveForm();
    });
  });

  // Phone masking
  function maskPhone(value: string): string {
    let d = value.replace(/\D/g, '').slice(0, 11);
    if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
    d = d.slice(0, 10);
    if (d.length <= 3) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  ['shipping-phone', 'pickup-phone'].forEach((id) => {
    const el = selector.querySelector<HTMLInputElement>(`#${id}`);
    if (!el) return;
    const applyMask = () => {
      const masked = maskPhone(el.value);
      el.value = masked;
      el.setSelectionRange(masked.length, masked.length);
    };
    el.addEventListener('input', applyMask);
    el.addEventListener('change', applyMask);
  });

  // ZIP: digits only + Zippopotam.us auto-fill cSpell:ignore Zippopotam.us
  const zipInput = selector.querySelector<HTMLInputElement>('#shipping-zip');
  const cityInput = selector.querySelector<HTMLInputElement>('#shipping-city');
  const stateSelect =
    selector.querySelector<HTMLSelectElement>('#shipping-state');

  zipInput?.addEventListener('input', () => {
    zipInput.value = zipInput.value.replace(/\D/g, '').slice(0, 5);
  });
  zipInput?.addEventListener('blur', async () => {
    const zip = zipInput.value;
    if (zip.length !== 5) return;
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        places: Array<{ 'place name': string; 'state abbreviation': string }>;
      };
      const place = data.places?.[0];
      if (!place) return;
      if (cityInput && !cityInput.value) cityInput.value = place['place name'];
      if (stateSelect && !stateSelect.value) {
        stateSelect.value = place['state abbreviation'];
        initFloatSelects(selector as Element);
      }
      saveForm();
      notifyValidity();
    } catch {
      /* silent */
    }
  });

  selector
    .querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >('input, select, textarea')
    .forEach((el) => {
      el.addEventListener('change', () => {
        saveForm();
        notifyValidity();
      });
      el.addEventListener('input', () => {
        saveForm();
        notifyValidity();
      });
    });

  function syncCart() {
    updateFreeShippingTracker(cart.getTotal());
  }
  syncCart();
  restoreForm();
  // If nothing was restored, open shipping tab by default
  if (!shippingRadio?.checked && !pickupRadio?.checked) {
    handleTabClick('shipping', false);
  }
  initFloatSelects(selector as Element);
  window.addEventListener('cartUpdated', syncCart);
}

let fulfillmentSelectorReady = false;

let initialized = false;

// Called once from FulfillmentSelector.astro's script tag. This module does NOT
// re-execute on a view-transition swap, so the listeners are registered once
// here (in the original order); initFulfillmentSelector re-runs on every
// astro:page-load and sets up whichever selector is on the new page.
export function init(): void {
  if (initialized) return;
  initialized = true;

  document.addEventListener('astro:page-load', initFulfillmentSelector);

  document.addEventListener('astro:page-load', () => {
    fulfillmentSelectorReady = true;
  });

  // cSpell:ignore giftcard
  document.addEventListener('cart:giftcard', (e: Event) => {
    const { hasGiftCard } = (e as CustomEvent).detail as {
      hasGiftCard: boolean;
    };
    const disclaimer = document.getElementById('gift-card-shipping-disclaimer');
    if (disclaimer) disclaimer.classList.toggle('hidden', !hasGiftCard);
    if (hasGiftCard && fulfillmentSelectorReady) {
      const hasSavedForm = !!sessionStorage.getItem('fulfillment-form');
      const anySelected = document.querySelector<HTMLButtonElement>(
        '[data-tab][aria-pressed="true"]'
      );
      if (!hasSavedForm && !anySelected) {
        document
          .querySelector<HTMLButtonElement>('[data-tab="pickup"]')
          ?.focus();
      }
    }
  });
}
