/**
 * Tests for the PDP gallery module's logic, in happy-dom. Browser-level
 * behavior (focus return, real swipes, the dialog itself) is covered by
 * e2e/pdp-gallery.stub.spec.ts.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initGallery } from '../gallery';

const IMGS = ['a.jpg', 'b.jpg', 'c.jpg'];

function thumb(src: string, active: boolean): string {
  return `<button type="button" class="gallery-thumb ${
    active
      ? 'border-(--ui-button-border) opacity-100'
      : 'border-(--border-secondary) opacity-60'
  }" data-gallery-src="${src}" aria-pressed="${active}"></button>`;
}

function setupDom(images: string[] = IMGS, { stripHidden = false } = {}): void {
  document.body.innerHTML = `
    <div id="product-image-container">
      <picture><img id="product-image" src="${images[0]}" alt="Test" data-hero-src="${images[0]}" /></picture>
      <button id="gallery-prev" class="hidden"></button>
      <button id="gallery-next" class="hidden"></button>
      <button id="gallery-zoom" class="hidden"></button>
      <p id="gallery-status"></p>
    </div>
    <div id="gallery-thumbnails" class="${stripHidden ? 'hidden' : ''}">
      ${images.length > 1 ? images.map((s, i) => thumb(s, i === 0)).join('') : ''}
    </div>
    <dialog id="pdp-lightbox">
      <div data-lightbox-backdrop>
        <img id="pdp-lightbox-image" src="" alt="" />
        <button id="pdp-lightbox-close"></button>
        <button id="pdp-lightbox-prev" class="hidden"></button>
        <button id="pdp-lightbox-next" class="hidden"></button>
        <p id="pdp-lightbox-count"></p>
      </div>
    </dialog>
  `;
}

const $ = (id: string) => document.getElementById(id)!;
const hero = () => $('product-image') as HTMLImageElement;
const selected = () =>
  Array.from(document.querySelectorAll('.gallery-thumb')).findIndex(
    (t) => t.getAttribute('aria-pressed') === 'true'
  );
const hidden = (id: string) => $(id).classList.contains('hidden');
const flush = () => new Promise((r) => setTimeout(r, 0)); // MutationObserver

describe('initGallery', () => {
  let cleanup: () => void;

  beforeEach(() => {
    setupDom();
    cleanup = initGallery();
  });
  afterEach(() => cleanup());

  describe('controls', () => {
    it('shows arrows and zoom when there are several images', () => {
      expect(hidden('gallery-prev')).toBe(false);
      expect(hidden('gallery-next')).toBe(false);
      expect(hidden('gallery-zoom')).toBe(false);
      expect(hidden('pdp-lightbox-prev')).toBe(false);
      expect(hidden('pdp-lightbox-next')).toBe(false);
    });

    it('shows only zoom for a single image', () => {
      cleanup();
      setupDom(['only.jpg']);
      cleanup = initGallery();

      expect(hidden('gallery-prev')).toBe(true);
      expect(hidden('gallery-next')).toBe(true);
      expect(hidden('gallery-zoom')).toBe(false);
    });

    it('does nothing when there is no hero image', () => {
      cleanup();
      document.body.innerHTML = '<div id="product-image-container"></div>';
      expect(() => (cleanup = initGallery())).not.toThrow();
    });
  });

  describe('stepping', () => {
    it('next/prev move through the images, wrapping at both ends', () => {
      $('gallery-next').click();
      expect(selected()).toBe(1);
      $('gallery-next').click();
      expect(selected()).toBe(2);
      $('gallery-next').click(); // wrap
      expect(selected()).toBe(0);
      $('gallery-prev').click(); // wrap back
      expect(selected()).toBe(2);
    });

    it('points the hero at the new image and updates the thumb styling', () => {
      $('gallery-next').click();

      expect(hero().dataset.heroSrc).toBe('b.jpg');
      const thumbs = document.querySelectorAll('.gallery-thumb');
      expect(thumbs[1].classList.contains('opacity-100')).toBe(true);
      expect(thumbs[0].classList.contains('opacity-60')).toBe(true);
      expect(thumbs[0].classList.contains('opacity-100')).toBe(false);
    });

    it('announces the position', () => {
      $('gallery-next').click();
      expect($('gallery-status').textContent).toBe('Image 2 of 3');
    });

    it('clicking a thumbnail selects it and arrows continue from there', () => {
      (document.querySelectorAll('.gallery-thumb')[2] as HTMLElement).click();
      expect(selected()).toBe(2);
      expect(hero().dataset.heroSrc).toBe('c.jpg');

      $('gallery-next').click();
      expect(selected()).toBe(0);
    });

    it('arrow keys step while focus is in the gallery', () => {
      $('gallery-next').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );
      expect(selected()).toBe(1);
      $('gallery-next').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
      );
      expect(selected()).toBe(0);
    });

    it('arrow keys do nothing with a single image', () => {
      cleanup();
      setupDom(['only.jpg']);
      cleanup = initGallery();
      const before = hero().dataset.heroSrc;

      $('gallery-zoom').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      );

      expect(hero().dataset.heroSrc).toBe(before);
    });
  });

  describe('swipe', () => {
    const pointer = (
      type: string,
      x: number,
      y: number,
      pointerType = 'touch'
    ) => {
      const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
      Object.defineProperty(e, 'pointerType', { value: pointerType });
      $('product-image-container').dispatchEvent(e);
    };

    it('a horizontal swipe steps in the swipe direction', () => {
      pointer('pointerdown', 300, 200);
      pointer('pointerup', 100, 205); // left -> next
      expect(selected()).toBe(1);

      pointer('pointerdown', 100, 200);
      pointer('pointerup', 300, 205); // right -> prev
      expect(selected()).toBe(0);
    });

    it('ignores a short move, a mostly-vertical move, and a mouse drag', () => {
      pointer('pointerdown', 200, 200);
      pointer('pointerup', 180, 200); // under the threshold
      expect(selected()).toBe(0);

      pointer('pointerdown', 200, 100);
      pointer('pointerup', 140, 400); // vertical wins
      expect(selected()).toBe(0);

      pointer('pointerdown', 300, 200, 'mouse');
      pointer('pointerup', 100, 205, 'mouse');
      expect(selected()).toBe(0);
    });

    it('a cancelled gesture does not step', () => {
      pointer('pointerdown', 300, 200);
      pointer('pointercancel', 300, 200);
      pointer('pointerup', 100, 205);
      expect(selected()).toBe(0);
    });
  });

  describe('lightbox', () => {
    it('opens from zoom with the current image and a count', () => {
      $('gallery-zoom').click();

      expect(($('pdp-lightbox') as HTMLDialogElement).open).toBe(true);
      expect(($('pdp-lightbox-image') as HTMLImageElement).src).toContain(
        'a.jpg'
      );
      expect($('pdp-lightbox-count').textContent).toBe('1 / 3');
    });

    it('follows navigation while open', () => {
      $('gallery-zoom').click();
      $('pdp-lightbox-next').click();

      expect(($('pdp-lightbox-image') as HTMLImageElement).src).toContain(
        'b.jpg'
      );
      expect($('pdp-lightbox-count').textContent).toBe('2 / 3');
      expect(selected()).toBe(1);
    });

    it('closes from the close button and from the backdrop, but not from the image', () => {
      const dialog = $('pdp-lightbox') as HTMLDialogElement;

      $('gallery-zoom').click();
      $('pdp-lightbox-close').click();
      expect(dialog.open).toBe(false);

      $('gallery-zoom').click();
      $('pdp-lightbox-image').click();
      expect(dialog.open).toBe(true);

      document.querySelector<HTMLElement>('[data-lightbox-backdrop]')!.click();
      expect(dialog.open).toBe(false);
    });

    it('opens from a click on the hero but not from a click on a control', () => {
      const dialog = $('pdp-lightbox') as HTMLDialogElement;

      $('gallery-next').click();
      expect(dialog.open).toBe(false);

      hero().click();
      expect(dialog.open).toBe(true);
    });
  });

  describe('when pdpUI changes the strip', () => {
    it('refreshes the controls when the strip is hidden (variant with <= 1 image)', async () => {
      $('gallery-thumbnails').classList.add('hidden');
      await flush();

      expect(hidden('gallery-prev')).toBe(true);
      expect(hidden('gallery-next')).toBe(true);
    });

    it('ignores stale thumbs left in a hidden strip', async () => {
      $('gallery-thumbnails').classList.add('hidden'); // thumbs stay in the DOM
      await flush();
      $('gallery-zoom').click();

      // One image (the hero), not the three stale thumbs
      expect($('pdp-lightbox-count').textContent).toBe('');
      expect(($('pdp-lightbox-image') as HTMLImageElement).src).toContain(
        'a.jpg'
      );
    });

    it('picks up a rebuilt strip', async () => {
      $('gallery-thumbnails').innerHTML = ['x.jpg', 'y.jpg']
        .map((s, i) => thumb(s, i === 0))
        .join('');
      await flush();

      $('gallery-next').click();
      expect(hero().dataset.heroSrc).toBe('y.jpg');
      $('gallery-next').click(); // two images now: wraps
      expect(hero().dataset.heroSrc).toBe('x.jpg');
    });

    it('shows the arrows when a single-image product gains a strip', async () => {
      cleanup();
      setupDom(['only.jpg']);
      cleanup = initGallery();
      expect(hidden('gallery-next')).toBe(true);

      $('gallery-thumbnails').innerHTML = ['p.jpg', 'q.jpg']
        .map((s, i) => thumb(s, i === 0))
        .join('');
      await flush();

      expect(hidden('gallery-next')).toBe(false);
    });
  });

  describe('zoom uses the recorded source, not the proxied src', () => {
    it('survives the hero src being replaced by a placeholder after a load error', () => {
      cleanup();
      setupDom(['only.jpg']);
      cleanup = initGallery();
      hero().src = 'data:image/svg+xml,logo'; // what the shimmer error handler does

      $('gallery-zoom').click();

      expect(($('pdp-lightbox-image') as HTMLImageElement).src).toContain(
        'only.jpg'
      );
    });
  });

  describe('cleanup', () => {
    it('detaches the listeners', () => {
      cleanup();
      $('gallery-next').click();
      expect(selected()).toBe(0);

      $('gallery-zoom').click();
      expect(($('pdp-lightbox') as HTMLDialogElement).open).toBe(false);
    });

    it('closes an open lightbox', () => {
      $('gallery-zoom').click();
      cleanup();
      expect(($('pdp-lightbox') as HTMLDialogElement).open).toBe(false);
    });
  });
});
