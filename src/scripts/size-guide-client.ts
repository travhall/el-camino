// Size guide dialog for apparel product pages (SizeGuide.astro).
//
// This used to be an inline script (`is:inline nonce`). That only works on a
// full page load: when a shopper arrives at a product by client-side navigation
// (the normal way), Astro's router re-creates any inline script the document
// has not already run, copying the destination response's nonce onto it. The
// browser is still enforcing the nonce from the first page load, so it blocks
// the script and the "Size Guide" button does nothing. A hoisted module is an
// external file, allowed by `script-src 'self'`.
//
// A module executes once per document, so the category (which differs per
// product) is read from #size-guide-config each time the dialog opens, and the
// trigger is re-bound on every astro:page-load.

const TOPS_ROWS = [
  ['XS', '31–33"', '23–25"', '33–35"'],
  ['S', '34–36"', '26–28"', '36–38"'],
  ['M', '37–39"', '29–31"', '39–41"'],
  ['L', '40–42"', '32–34"', '42–44"'],
  ['XL', '43–45"', '35–37"', '45–47"'],
  ['2XL', '46–48"', '38–40"', '48–50"'],
];

const BOTTOMS_ROWS = [
  ['28', '28"', '28"', '30"'],
  ['30', '30"', '30"', '31"'],
  ['32', '32"', '32"', '32"'],
  ['34', '34"', '34"', '33"'],
  ['36', '36"', '36"', '34"'],
  ['38', '38"', '38"', '35"'],
];

// The component's own default is 'tops', so that is what a missing or
// unreadable config means.
function readCategory(): string {
  try {
    const text = document.getElementById('size-guide-config')?.textContent;
    const category = text ? JSON.parse(text).category : undefined;
    return typeof category === 'string' ? category : 'tops';
  } catch {
    return 'tops';
  }
}

function openSizeGuide(): void {
  const portalRoot = document.getElementById('portal-root');
  if (!portalRoot) return;

  const triggerElement = document.activeElement as HTMLElement | null;

  document.body.style.overflow = 'hidden';

  const isTops = readCategory() === 'tops';
  const rows = isTops ? TOPS_ROWS : BOTTOMS_ROWS;
  const headers = isTops
    ? ['Size', 'Chest', 'Waist', 'Hips']
    : ['Waist', 'Waist (actual)', 'Hip', 'Inseam'];

  const tableRows = rows
    .map(
      (r) =>
        `<tr class="border-b border-(--border-secondary) last:border-0">
            ${r.map((cell, i) => `<td class="py-2 px-3 text-sm ${i === 0 ? 'font-semibold text-(--content-heading)' : 'text-(--content-body)'}">${cell}</td>`).join('')}
          </tr>`
    )
    .join('');

  const backdrop = document.createElement('div');
  backdrop.className =
    'fixed inset-0 bg-(--ui-modal-overlay)/90 z-[9998] flex items-center justify-center p-4 opacity-0 transition-opacity duration-300 ease-out';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'size-guide-title');

  const modal = document.createElement('div');
  modal.className =
    'bg-(--ui-modal-surface) text-(--ui-modal-text) border-2 border-(--ui-modal-border) rounded panel-shadow max-w-md w-full max-h-[90vh] overflow-y-auto transform scale-95 opacity-0 transition-all duration-300 ease-out';

  modal.innerHTML = `
      <div>
        <div class="flex items-center justify-between p-5 border-b-2 border-(--border-secondary)">
          <h2 id="size-guide-title" class="font-display text-2xl text-(--content-heading)">
            Size Guide
          </h2>
          <button
            id="size-guide-close"
            class="p-2 border-2 border-(--border-primary) rounded-sm text-(--content-meta) hover:text-(--content-heading) hover:border-(--ui-nav-border) transition-all"
            aria-label="Close size guide"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="p-5">
          <p class="text-xs text-(--content-meta) mb-4 uppercase tracking-widest">
            ${isTops ? 'Tops &amp; Outerwear' : 'Bottoms &amp; Pants'} — measurements in inches
          </p>
          <div class="overflow-x-auto -mx-1">
            <table class="w-full min-w-[280px]">
              <thead>
                <tr class="border-b-2 border-(--border-primary)">
                  ${headers.map((h) => `<th class="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-(--content-meta)">${h}</th>`).join('')}
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
          <p class="mt-4 text-xs text-(--content-meta) italic">
            Measurements are approximate. When between sizes, we recommend sizing up.
          </p>
        </div>
      </div>
    `;

  backdrop.appendChild(modal);
  portalRoot.appendChild(backdrop);

  requestAnimationFrame(() => {
    backdrop.classList.remove('opacity-0');
    modal.classList.remove('scale-95', 'opacity-0');
    modal.classList.add('scale-100', 'opacity-100');
  });

  const closeBtn = modal.querySelector<HTMLElement>('#size-guide-close');

  const close = () => {
    backdrop.classList.add('opacity-0');
    modal.classList.remove('scale-100', 'opacity-100');
    modal.classList.add('scale-95', 'opacity-0');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      backdrop.remove();
      document.body.style.overflow = 'unset';
      triggerElement?.focus();
    }, 300);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      return;
    }

    if (e.key !== 'Tab') return;

    const focusable = Array.from(
      modal.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  closeBtn?.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);
  closeBtn?.focus();
}

function bindTrigger(): void {
  const trigger = document.getElementById('size-guide-trigger');
  if (!trigger || trigger.dataset.initialized) return;
  trigger.dataset.initialized = 'true';
  trigger.addEventListener('click', openSizeGuide);
}

let initialized = false;

// Called once from SizeGuide.astro's script tag. The module does NOT re-execute
// on a view-transition swap, so the trigger of whichever product page is on
// screen is bound on every astro:page-load.
export function init(): void {
  if (initialized) return;
  initialized = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindTrigger);
  } else {
    bindTrigger();
  }
  document.addEventListener('astro:page-load', bindTrigger);
}
