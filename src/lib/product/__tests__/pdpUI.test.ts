/**
 * Characterization tests for PDPUIManager (plan 142). No mocking needed —
 * PDPUIManager has no external module dependencies beyond pure helpers/types,
 * so these tests exercise real DOM via happy-dom.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PDPUIManager } from '../pdpUI';
import { ProductAvailabilityState, type ProductAvailabilityInfo, type SaleInfo } from '@/lib/square/types';

function setupDom(): void {
  document.body.innerHTML = `
    <div id="price-display"><span id="unit-display" class="hidden"></span></div>
    <div id="original-price-display" class="hidden"></div>
    <input id="quantity-input" />
    <button id="add-to-cart-button"></button>
    <button id="decrease-quantity"></button>
    <button id="increase-quantity"></button>
    <img id="product-image" />
    <div id="product-image-container"></div>
    <div id="remaining-count"></div>
    <div id="cart-quantity"></div>
    <div id="inventory-status"></div>
    <div id="quantity-stepper"></div>
    <div id="gallery-thumbnails"></div>
  `;
}

function availabilityInfo(
  overrides: Partial<ProductAvailabilityInfo> = {}
): ProductAvailabilityInfo {
  return {
    state: ProductAvailabilityState.AVAILABLE,
    totalInventory: 10,
    inCart: 0,
    remaining: 10,
    ...overrides,
  };
}

describe('PDPUIManager', () => {
  let manager: PDPUIManager;

  beforeEach(() => {
    setupDom();
    manager = new PDPUIManager();
  });

  describe('updateQuantityControls', () => {
    it('sets value/max for an in-stock product and enables increase (default quantity always starts at 1)', () => {
      manager.updateQuantityControls(availabilityInfo({ remaining: 5 }));
      const input = document.getElementById('quantity-input') as HTMLInputElement;
      const decrease = document.getElementById('decrease-quantity') as HTMLButtonElement;
      const increase = document.getElementById('increase-quantity') as HTMLButtonElement;

      expect(input.value).toBe('1');
      expect(input.max).toBe('5');
      expect(input.disabled).toBe(false);
      // defaultQty is always 1 for AVAILABLE, so decrease starts disabled regardless of remaining
      expect(decrease.disabled).toBe(true);
      expect(increase.disabled).toBe(false);
    });

    it('disables decrease at quantity 1 and increase at max via default quantity boundaries', () => {
      manager.updateQuantityControls(availabilityInfo({ remaining: 1 }));
      const decrease = document.getElementById('decrease-quantity') as HTMLButtonElement;
      const increase = document.getElementById('increase-quantity') as HTMLButtonElement;

      // defaultQty (1) <= 1 -> decrease disabled; defaultQty (1) >= effectiveMax (1) -> increase disabled
      expect(decrease.disabled).toBe(true);
      expect(increase.disabled).toBe(true);
    });

    it('disables the input entirely when not AVAILABLE', () => {
      manager.updateQuantityControls(
        availabilityInfo({ state: ProductAvailabilityState.OUT_OF_STOCK, remaining: 0, totalInventory: 0 })
      );
      const input = document.getElementById('quantity-input') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });

    it('caps gift cards at max 10, defaults to quantity 1, and never disables the input', () => {
      manager.updateQuantityControls(
        availabilityInfo({ state: ProductAvailabilityState.OUT_OF_STOCK, remaining: 0, totalInventory: 0 }),
        true
      );
      const input = document.getElementById('quantity-input') as HTMLInputElement;
      expect(input.value).toBe('1');
      expect(input.max).toBe('10');
      expect(input.disabled).toBe(false);
    });

    it('shows the stepper when AVAILABLE and effectiveMax > 1', () => {
      manager.updateQuantityControls(availabilityInfo({ remaining: 5 }));
      const stepper = document.getElementById('quantity-stepper');
      expect(stepper?.classList.contains('hidden')).toBe(false);
    });

    it('hides the stepper when AVAILABLE but effectiveMax is 1', () => {
      manager.updateQuantityControls(availabilityInfo({ remaining: 1 }));
      const stepper = document.getElementById('quantity-stepper');
      expect(stepper?.classList.contains('hidden')).toBe(true);
    });

    it('always shows the stepper for gift cards', () => {
      manager.updateQuantityControls(
        availabilityInfo({ state: ProductAvailabilityState.OUT_OF_STOCK, remaining: 0, totalInventory: 0 }),
        true
      );
      const stepper = document.getElementById('quantity-stepper');
      expect(stepper?.classList.contains('hidden')).toBe(false);
    });
  });

  describe('updateAddToCartButton', () => {
    it('sets enabled "Add to Cart" text for AVAILABLE', () => {
      manager.updateAddToCartButton(availabilityInfo());
      const button = document.getElementById('add-to-cart-button') as HTMLButtonElement;
      expect(button.textContent).toBe('Add to Cart');
      expect(button.disabled).toBe(false);
    });

    it('sets disabled "Sold Out" text for OUT_OF_STOCK', () => {
      manager.updateAddToCartButton(
        availabilityInfo({ state: ProductAvailabilityState.OUT_OF_STOCK, remaining: 0, totalInventory: 0 })
      );
      const button = document.getElementById('add-to-cart-button') as HTMLButtonElement;
      expect(button.textContent).toBe('Sold Out');
      expect(button.disabled).toBe(true);
    });
  });

  describe('updateImageOverlay', () => {
    it('injects a stock overlay and dims the image for OUT_OF_STOCK', () => {
      manager.updateImageOverlay(
        availabilityInfo({ state: ProductAvailabilityState.OUT_OF_STOCK, remaining: 0, totalInventory: 0 })
      );
      const container = document.getElementById('product-image-container');
      const overlay = container?.querySelector('[data-overlay="stock"]');
      const image = document.getElementById('product-image');
      expect(overlay).not.toBeNull();
      expect(image?.classList.contains('opacity-75')).toBe(true);
    });

    it('injects a sale overlay with the discount percent when saleInfo is given and not out of stock', () => {
      const saleInfo: SaleInfo = { salePrice: 10, originalPrice: 20, discountPercent: 50 };
      manager.updateImageOverlay(availabilityInfo(), saleInfo);
      const overlay = document
        .getElementById('product-image-container')
        ?.querySelector('[data-overlay="sale"]');
      expect(overlay?.textContent).toBe('50% Off');
    });

    it('removes an existing overlay before adding a new one', () => {
      manager.updateImageOverlay(
        availabilityInfo({ state: ProductAvailabilityState.OUT_OF_STOCK, remaining: 0, totalInventory: 0 })
      );
      manager.updateImageOverlay(availabilityInfo());
      const overlays = document
        .getElementById('product-image-container')
        ?.querySelectorAll('[data-overlay]');
      expect(overlays?.length).toBe(0);
    });
  });

  describe('updateInventoryDisplay', () => {
    it('hides remaining-count for gift cards', () => {
      manager.updateInventoryDisplay(availabilityInfo(), true);
      expect(document.getElementById('remaining-count')?.classList.contains('hidden')).toBe(true);
    });

    it('shows remaining-count text for non-gift-cards', () => {
      manager.updateInventoryDisplay(availabilityInfo({ remaining: 7 }));
      const el = document.getElementById('remaining-count');
      expect(el?.classList.contains('hidden')).toBe(false);
      expect(el?.textContent).toBe('7 available');
    });

    it('shows the in-cart count only when inCart > 0', () => {
      manager.updateInventoryDisplay(availabilityInfo({ inCart: 2 }));
      const el = document.getElementById('cart-quantity');
      expect(el?.classList.contains('hidden')).toBe(false);
      expect(el?.textContent).toBe('( 2 in cart )');
    });

    it('hides the in-cart count when inCart is 0', () => {
      manager.updateInventoryDisplay(availabilityInfo({ inCart: 0 }));
      expect(document.getElementById('cart-quantity')?.classList.contains('hidden')).toBe(true);
    });

    it('injects the out-of-stock message only for OUT_OF_STOCK', () => {
      manager.updateInventoryDisplay(
        availabilityInfo({ state: ProductAvailabilityState.OUT_OF_STOCK, remaining: 0, totalInventory: 0 })
      );
      expect(document.getElementById('inventory-status')?.textContent).toContain(
        'currently out of stock'
      );
    });

    it('clears inventory-status for non OUT_OF_STOCK states', () => {
      manager.updateInventoryDisplay(availabilityInfo());
      expect(document.getElementById('inventory-status')?.innerHTML).toBe('');
    });
  });

  describe('updatePriceDisplay', () => {
    it('sets the formatted price and hides original-price-display when no saleInfo', () => {
      manager.updatePriceDisplay(19.99);
      expect(document.getElementById('price-display')?.textContent).toContain('19.99');
      expect(document.getElementById('original-price-display')?.classList.contains('hidden')).toBe(
        true
      );
    });

    it('shows strikethrough original price and sale price when saleInfo is given', () => {
      const saleInfo: SaleInfo = { salePrice: 15, originalPrice: 20, discountPercent: 25 };
      manager.updatePriceDisplay(15, { saleInfo });
      const original = document.getElementById('original-price-display');
      expect(original?.classList.contains('hidden')).toBe(false);
      expect(original?.textContent).toContain('20.00');
      expect(document.getElementById('price-display')?.textContent).toContain('15.00');
    });

    it('re-attaches unit-display as a child of price-display and shows it when a unit is passed', () => {
      manager.updatePriceDisplay(10, { unit: 'per lb' });
      const priceDisplay = document.getElementById('price-display');
      const unitDisplay = document.getElementById('unit-display');
      expect(priceDisplay?.contains(unitDisplay as Node)).toBe(true);
      expect(unitDisplay?.classList.contains('hidden')).toBe(false);
      expect(unitDisplay?.textContent).toBe('per lb');
    });

    it('re-attaches unit-display but keeps it hidden when no unit is passed', () => {
      manager.updatePriceDisplay(10);
      const priceDisplay = document.getElementById('price-display');
      const unitDisplay = document.getElementById('unit-display');
      expect(priceDisplay?.contains(unitDisplay as Node)).toBe(true);
      expect(unitDisplay?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('updateAttributeButtonStates', () => {
    function setupButton(): void {
      document.body.innerHTML += `
        <button data-attribute-type="color" data-attribute-value="red"></button>
        <button data-attribute-type="color" data-attribute-value="blue"></button>
      `;
    }

    it('marks an available, selected button as selected with no out-of-stock styling', () => {
      setupButton();
      manager.updateAttributeButtonStates(
        { color: ['red', 'blue'] },
        { color: 'red' },
        () => true
      );
      const red = document.querySelector('[data-attribute-value="red"]') as HTMLButtonElement;
      expect(red.getAttribute('aria-pressed')).toBe('true');
      expect(red.classList.contains('line-through')).toBe(false);
      expect(red.hasAttribute('aria-label')).toBe(false);
    });

    it('marks an unavailable, unselected button with out-of-stock styling and aria-label', () => {
      setupButton();
      manager.updateAttributeButtonStates(
        { color: ['red', 'blue'] },
        { color: 'red' },
        (_type, value) => value !== 'blue'
      );
      const blue = document.querySelector('[data-attribute-value="blue"]') as HTMLButtonElement;
      expect(blue.getAttribute('aria-pressed')).toBe('false');
      expect(blue.classList.contains('line-through')).toBe(true);
      expect(blue.getAttribute('aria-label')).toBe('blue — out of stock');
    });
  });

  describe('getQuantityValue / resetQuantityToOne', () => {
    it('round-trips: reset sets value to 1, and getQuantityValue reads it back', () => {
      const input = document.getElementById('quantity-input') as HTMLInputElement;
      input.value = '5';
      expect(manager.getQuantityValue()).toBe(5);

      manager.resetQuantityToOne();
      expect(input.value).toBe('1');
      expect(manager.getQuantityValue()).toBe(1);
    });
  });

  describe('updateGalleryThumbnails', () => {
    it('hides the container for 0 images', () => {
      manager.updateGalleryThumbnails([]);
      expect(document.getElementById('gallery-thumbnails')?.classList.contains('hidden')).toBe(true);
    });

    it('hides the container for 1 image', () => {
      manager.updateGalleryThumbnails(['a.jpg']);
      expect(document.getElementById('gallery-thumbnails')?.classList.contains('hidden')).toBe(true);
    });

    it('renders one thumbnail per image for 2+, marks the first aria-pressed, and updates the main image', () => {
      manager.updateGalleryThumbnails(['a.jpg', 'b.jpg', 'c.jpg']);
      const container = document.getElementById('gallery-thumbnails');
      const thumbs = container?.querySelectorAll('.gallery-thumb');
      expect(container?.classList.contains('hidden')).toBe(false);
      expect(thumbs?.length).toBe(3);
      expect(thumbs?.[0].getAttribute('aria-pressed')).toBe('true');
      expect(thumbs?.[1].getAttribute('aria-pressed')).toBe('false');
      expect((document.getElementById('product-image') as HTMLImageElement).src).toContain('a.jpg');
    });
  });
});
