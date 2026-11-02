// src/lib/product/gallery.ts
//
// PDP image gallery: previous/next arrows, touch swipe, and a zoom lightbox,
// layered over the existing thumbnail strip.
//
// The thumbnail strip stays the single source of truth for "which images
// exist and which is showing" (the selected thumb is the current image).
// pdpUI rebuilds that strip when the selected variant has its own image set,
// and a MutationObserver here picks the change up, so the two never need to
// call each other.
//
// Products with one image per variant (e.g. color variants) have no strip;
// the controls then reduce to zoom on the single hero image.
//
// The PDP and QuickView run this same code, each against its own elements
// (see GalleryConfig). QuickView has no zoom lightbox.
import { setHeroImage, sourceImageUrl } from './pdpUI';
import { toNetlifyImageCDN } from '@/lib/image/enhanced-optimizer';

const SWIPE_MIN_PX = 40;
// How much more horizontal than vertical a gesture must be to count as a swipe
const SWIPE_DOMINANCE = 1.5;
const LIGHTBOX_WIDTH = 1600;

const THUMB_ACTIVE = ['border-(--ui-button-border)', 'opacity-100'];
const THUMB_INACTIVE = ['border-(--border-secondary)', 'opacity-60'];

/** Which elements a gallery drives, and how it swaps the hero image. */
export interface GalleryConfig {
  containerId: string;
  heroId: string;
  stripId: string;
  /** Class on each thumbnail button in the strip (no leading dot) */
  thumbClass: string;
  prevId: string;
  nextId: string;
  /** Live region that announces "Image n of m" */
  statusId: string;
  /** Wire up the zoom button, click-to-zoom and the lightbox (PDP only) */
  zoom: boolean;
  /**
   * Swap the hero to `url` and fade it in. Defaults to the PDP's picture-aware
   * swap; QuickView's plain <img> sizes its own URLs.
   */
  showImage?: (hero: HTMLImageElement, url: string) => void;
}

export const PDP_GALLERY: GalleryConfig = {
  containerId: 'product-image-container',
  heroId: 'product-image',
  stripId: 'gallery-thumbnails',
  thumbClass: 'gallery-thumb',
  prevId: 'gallery-prev',
  nextId: 'gallery-next',
  statusId: 'gallery-status',
  zoom: true,
};

/** Cross-fade the PDP hero. setHeroImage drops the <picture> <source>s that
 *  would otherwise pin the original image. */
function showPdpImage(main: HTMLImageElement, url: string): void {
  main.classList.remove('opacity-100');
  main.classList.add('opacity-0');
  setHeroImage(main, url);
  const reveal = () => {
    main.classList.remove('opacity-0');
    main.classList.add('opacity-100');
  };
  if (main.complete && main.naturalWidth > 0) {
    reveal(); // cached: onload won't fire
  } else {
    main.onload = reveal;
    main.onerror = reveal;
  }
}

/**
 * Wire up a gallery for the current page. Returns a cleanup function that
 * detaches everything (call it before the DOM is swapped out).
 */
export function initGallery(config: GalleryConfig = PDP_GALLERY): () => void {
  const abort = new AbortController();
  const { signal } = abort;

  const byId = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T | null;

  const container = byId(config.containerId);
  const strip = byId(config.stripId);
  const prevBtn = byId<HTMLButtonElement>(config.prevId);
  const nextBtn = byId<HTMLButtonElement>(config.nextId);
  const status = byId(config.statusId);
  // Zoom is PDP-only: without it there's no button, dialog or click-to-open
  const zoomBtn = config.zoom ? byId<HTMLButtonElement>('gallery-zoom') : null;
  const dialog = config.zoom ? byId<HTMLDialogElement>('pdp-lightbox') : null;
  const lbImage = config.zoom
    ? byId<HTMLImageElement>('pdp-lightbox-image')
    : null;
  const lbCount = config.zoom ? byId('pdp-lightbox-count') : null;
  const lbClose = config.zoom
    ? byId<HTMLButtonElement>('pdp-lightbox-close')
    : null;
  const lbPrev = config.zoom
    ? byId<HTMLButtonElement>('pdp-lightbox-prev')
    : null;
  const lbNext = config.zoom
    ? byId<HTMLButtonElement>('pdp-lightbox-next')
    : null;

  const hero = () => byId<HTMLImageElement>(config.heroId);

  if (!container || !hero()) return () => {};

  const thumbSelector = `.${config.thumbClass}`;
  const thumbs = (): HTMLButtonElement[] =>
    Array.from(strip?.querySelectorAll<HTMLButtonElement>(thumbSelector) ?? []);

  // The strip is only "live" while it is shown with more than one thumb. pdpUI
  // can leave stale thumbs in a hidden strip, which must not count.
  const inGalleryMode = () =>
    !!strip && !strip.classList.contains('hidden') && thumbs().length > 1;

  /** Source URLs of every image in the gallery (just the hero if there's no strip). */
  function images(): string[] {
    if (inGalleryMode()) {
      return thumbs()
        .map((t) => t.dataset.gallerySrc)
        .filter((s): s is string => !!s);
    }
    const main = hero();
    const current =
      main?.dataset.heroSrc ??
      sourceImageUrl(main?.getAttribute('src') ?? null);
    return current ? [current] : [];
  }

  function currentIndex(): number {
    if (!inGalleryMode()) return 0;
    const i = thumbs().findIndex(
      (t) => t.getAttribute('aria-pressed') === 'true'
    );
    return i === -1 ? 0 : i;
  }

  const announce = (message: string) => {
    if (status) status.textContent = message;
  };

  /** Show/hide controls to match how many images there are right now. */
  function refresh(): void {
    const many = images().length > 1;
    for (const btn of [prevBtn, nextBtn, lbPrev, lbNext]) {
      btn?.classList.toggle('hidden', !many);
    }
    // Zoom works with a single image, so it shows whenever there is a hero
    if (config.zoom) {
      zoomBtn?.classList.remove('hidden');
      container?.classList.add('cursor-zoom-in');
    }
  }

  function syncLightbox(): void {
    if (!dialog?.open || !lbImage) return;
    const list = images();
    const i = currentIndex();
    const src = list[i];
    if (!src) return;

    lbImage.src = toNetlifyImageCDN(src, LIGHTBOX_WIDTH, { quality: 85 });
    lbImage.alt = hero()?.alt ?? '';
    if (lbCount) {
      lbCount.textContent = list.length > 1 ? `${i + 1} / ${list.length}` : '';
    }
  }

  /** Make `index` (wrapping at the ends) the current image. */
  function showImage(index: number): void {
    const list = images();
    const main = hero();
    if (!list.length || !main) return;

    const n = list.length;
    const i = ((index % n) + n) % n;

    if (inGalleryMode()) {
      thumbs().forEach((t, ti) => {
        const active = ti === i;
        t.classList.remove(...(active ? THUMB_INACTIVE : THUMB_ACTIVE));
        t.classList.add(...(active ? THUMB_ACTIVE : THUMB_INACTIVE));
        t.setAttribute('aria-pressed', String(active));
        if (active) t.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      });
    }

    (config.showImage ?? showPdpImage)(main, list[i]);

    if (n > 1) announce(`Image ${i + 1} of ${n}`);
    syncLightbox();
  }

  const step = (by: number) => showImage(currentIndex() + by);

  function openLightbox(): void {
    if (!dialog || !lbImage || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    syncLightbox();
  }

  // --- thumbnails ---------------------------------------------------------
  strip?.addEventListener(
    'click',
    (e) => {
      const thumb = (e.target as Element).closest<HTMLButtonElement>(
        thumbSelector
      );
      if (!thumb) return;
      const i = thumbs().indexOf(thumb);
      if (i !== -1) showImage(i);
    },
    { signal }
  );

  // --- arrows -------------------------------------------------------------
  prevBtn?.addEventListener('click', () => step(-1), { signal });
  nextBtn?.addEventListener('click', () => step(1), { signal });
  lbPrev?.addEventListener('click', () => step(-1), { signal });
  lbNext?.addEventListener('click', () => step(1), { signal });

  const arrowKeys = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (images().length < 2) return;
    e.preventDefault();
    step(e.key === 'ArrowRight' ? 1 : -1);
  };
  container.addEventListener('keydown', arrowKeys, { signal });
  dialog?.addEventListener('keydown', arrowKeys, { signal });

  // --- swipe (touch/pen only; a mouse drag shouldn't change the image) -----
  let startX = 0;
  let startY = 0;
  let tracking = false;
  let suppressClick = false;

  container.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse') return;
      if ((e.target as Element).closest('button')) return;
      tracking = true;
      startX = e.clientX;
      startY = e.clientY;
    },
    { signal }
  );
  container.addEventListener(
    'pointerup',
    (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (
        Math.abs(dx) >= SWIPE_MIN_PX &&
        Math.abs(dx) > Math.abs(dy) * SWIPE_DOMINANCE &&
        images().length > 1
      ) {
        step(dx < 0 ? 1 : -1);
        // The gesture can still end in a click; it shouldn't open the lightbox
        suppressClick = true;
        setTimeout(() => (suppressClick = false), 350);
      }
    },
    { signal }
  );
  container.addEventListener('pointercancel', () => (tracking = false), {
    signal,
  });

  // --- zoom ---------------------------------------------------------------
  zoomBtn?.addEventListener('click', openLightbox, { signal });
  container.addEventListener(
    'click',
    (e) => {
      if (!config.zoom) return;
      if ((e.target as Element).closest('button')) return;
      if (suppressClick) return;
      openLightbox();
    },
    { signal }
  );

  lbClose?.addEventListener('click', () => dialog?.close(), { signal });
  // A click on the dim area around the image (the dialog or its full-size
  // wrapper) closes it; clicks on the image and buttons don't.
  dialog?.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element;
      if (t === dialog || t.hasAttribute('data-lightbox-backdrop'))
        dialog.close();
    },
    { signal }
  );

  // --- keep controls in step when pdpUI rebuilds or hides the strip --------
  const observer = new MutationObserver(refresh);
  if (strip) {
    observer.observe(strip, {
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  refresh();

  return () => {
    abort.abort();
    observer.disconnect();
    if (dialog?.open) dialog.close();
  };
}
