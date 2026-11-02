// src/lib/ui/filmstrip.ts
//
// Previous/next buttons for a horizontally scrolling row of cards that hides
// its scrollbar (the related-products filmstrip). With the scrollbar hidden, a
// mouse user has no visible sign that the row scrolls, nor a way to scroll it
// short of shift+wheel; touch users swipe and keyboard users tab through the
// cards, so those already work.
//
// Markup contract (see RelatedProducts.astro):
//   [data-filmstrip]               root
//     [data-filmstrip-viewport]    the scrolling element
//     [data-filmstrip-controls]    wrapper for the buttons; gets data-overflow
//     [data-filmstrip-prev|next]   the buttons
//
// Buttons use aria-disabled, not disabled: a keyboard user pressing "next"
// until the end would otherwise lose focus when the button disables itself.

/** How far one press scrolls, as a fraction of the visible width */
const STEP_RATIO = 0.8;
const MIN_STEP_PX = 200;
/** Sub-pixel scroll positions: treat within this of an edge as at the edge */
const EDGE_TOLERANCE_PX = 2;

function setDisabled(button: HTMLElement | null, disabled: boolean): void {
  button?.setAttribute('aria-disabled', String(disabled));
}

/** Wire up one filmstrip. Returns a cleanup function. */
export function initFilmstrip(root: HTMLElement): () => void {
  const viewport = root.querySelector<HTMLElement>('[data-filmstrip-viewport]');
  const controls = root.querySelector<HTMLElement>('[data-filmstrip-controls]');
  const prev = root.querySelector<HTMLElement>('[data-filmstrip-prev]');
  const next = root.querySelector<HTMLElement>('[data-filmstrip-next]');
  if (!viewport) return () => {};

  const abort = new AbortController();
  const { signal } = abort;

  const maxScroll = () => viewport.scrollWidth - viewport.clientWidth;

  function update(): void {
    const max = maxScroll();
    const overflowing = max > EDGE_TOLERANCE_PX;

    // Nothing to scroll: hide the buttons rather than show two dead ones
    controls?.setAttribute('data-overflow', String(overflowing));
    setDisabled(
      prev,
      !overflowing || viewport!.scrollLeft <= EDGE_TOLERANCE_PX
    );
    setDisabled(
      next,
      !overflowing || viewport!.scrollLeft >= max - EDGE_TOLERANCE_PX
    );
  }

  function step(direction: 1 | -1, button: HTMLElement | null): void {
    if (button?.getAttribute('aria-disabled') === 'true') return;

    const reduceMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    viewport!.scrollBy({
      left:
        direction * Math.max(viewport!.clientWidth * STEP_RATIO, MIN_STEP_PX),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }

  prev?.addEventListener('click', () => step(-1, prev), { signal });
  next?.addEventListener('click', () => step(1, next), { signal });
  viewport.addEventListener('scroll', update, { signal, passive: true });
  window.addEventListener('resize', update, { signal });

  // Cards load and wrap after first paint, which changes whether it overflows
  let observer: ResizeObserver | undefined;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(update);
    observer.observe(viewport);
    if (viewport.firstElementChild)
      observer.observe(viewport.firstElementChild);
  }

  update();

  return () => {
    abort.abort();
    observer?.disconnect();
  };
}

/**
 * Wire up every filmstrip on the page. Safe to call repeatedly (it re-runs on
 * astro:page-load): one already wired is skipped; a swapped-in one is new DOM.
 */
export function initFilmstrips(scope: ParentNode = document): void {
  scope.querySelectorAll<HTMLElement>('[data-filmstrip]').forEach((root) => {
    if (root.dataset.filmstripInit === 'true') return;
    root.dataset.filmstripInit = 'true';
    initFilmstrip(root);
  });
}
