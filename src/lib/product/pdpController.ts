// src/lib/product/pdpController.ts
import { cart } from '@/lib/cart';
import { findVariationByAttributes } from '@/lib/square/variationParser';
import { createVariantSlug } from '@/lib/square/slugUtils';
import {
  processClientError,
  logError,
  createError,
  ErrorType,
} from '@/lib/square/errorUtils';
import type { ProductVariation } from '@/lib/square/types';
import { PDPUIManager } from './pdpUI';
import { PDPEventManager, type ProductPageData } from './pdpEvents';

export class PDPController {
  private selectedAttributes: Record<string, string> = {};
  private currentVariation: ProductVariation | null = null;
  private uiManager: PDPUIManager;
  private eventManager: PDPEventManager;

  constructor(private productData: ProductPageData) {
    this.uiManager = new PDPUIManager();
    this.eventManager = new PDPEventManager(this.uiManager, productData, {
      onAttributeSelection: this.handleAttributeSelection.bind(this),
      onVariationSelection: this.handleVariationSelection.bind(this),
      onCartUpdate: this.handleCartUpdate.bind(this),
    });

    this.initialize();
  }

  private initialize(): void {
    // Find initial variation and set attributes
    this.currentVariation =
      this.productData.variations.find(
        (v) => v.variationId === this.productData.selectedVariationId
      ) ?? null;

    if (this.currentVariation?.attributes) {
      this.selectedAttributes = { ...this.currentVariation.attributes };
    }

    // Setup all event handlers
    this.eventManager.setupAllEventHandlers();

    // Initialize UI state
    if (this.currentVariation) {
      this.updateProductUI(this.currentVariation);
    }

    this.updateAttributeButtonStates();
  }

  /**
   * The variation that selecting `value` for `attributeType` should land on.
   *
   * If the exact combination exists it is returned as-is, even when sold out:
   * the shopper picked it deliberately and the back-in-stock form needs that
   * variation's real ID. If the combination doesn't exist (a sparse matrix,
   * e.g. Black comes in S/M but not L), snap to the closest variation that
   * has the requested value: keep as many of the other current selections as
   * possible, then prefer in stock, then catalog order.
   */
  private resolveVariation(
    attributeType: string,
    value: string
  ): ProductVariation | undefined {
    const wanted = { ...this.selectedAttributes, [attributeType]: value };
    const exact = findVariationByAttributes(
      this.productData.variations,
      wanted
    );
    if (exact) return exact;

    const matchesInCommon = (v: ProductVariation): number =>
      Object.entries(wanted).filter(([k, val]) => v.attributes?.[k] === val)
        .length;

    return this.productData.variations
      .filter((v) => v.attributes?.[attributeType] === value)
      .sort(
        (a, b) =>
          matchesInCommon(b) - matchesInCommon(a) ||
          Number(Boolean(b.inStock)) - Number(Boolean(a.inStock))
      )[0];
  }

  private updateProductUI(variation: ProductVariation): void {
    if (!variation) return;

    this.currentVariation = variation;
    this.updateVariantUrl(variation);

    const availabilityInfo = cart.getProductAvailability(
      this.productData.productId,
      variation.variationId,
      variation.quantity || 0
    );

    this.uiManager.updateAvailabilityDisplay(
      availabilityInfo,
      variation.saleInfo
    );
    this.uiManager.updatePriceDisplay(variation.price, {
      unit: variation.unit,
      saleInfo: variation.saleInfo,
    });

    if (variation.image) {
      this.uiManager.updateProductImage(variation.image);
    }

    // Only rebuild the thumbnail gallery when this variation owns a multi-image set.
    // For products where images live at the Item level (shared across all variants),
    // variation.images is undefined — in that case leave the SSR-rendered gallery
    // alone so the existing thumbnails stay visible and clickable.
    if (variation.images && variation.images.length > 1) {
      this.uiManager.updateGalleryThumbnails(variation.images);
    }

    // Show/hide back-in-stock form based on this variation's stock status
    const inStock = variation.inStock ?? (variation.quantity || 0) > 0;
    this.updateBisSection(variation, inStock);

    this.updateButtonProductData(variation);
  }

  private updateButtonProductData(variation: ProductVariation): void {
    const button = document.getElementById(
      'add-to-cart-button'
    ) as HTMLButtonElement;
    if (!button?.dataset.product) return;

    try {
      const productData = JSON.parse(button.dataset.product);
      productData.variationId = variation.variationId;
      productData.variationName = variation.name;
      productData.price = variation.price;
      if (variation.image) productData.image = variation.image;
      if (variation.unit) productData.unit = variation.unit;

      this.uiManager.updateButtonProductData(productData);
    } catch (error) {
      const appError = createError(
        ErrorType.DATA_PARSING,
        'Failed to update button product data',
        {
          source: 'updateButtonProductData',
          originalError: error,
        }
      );
      logError(appError);
    }
  }

  private updateVariantUrl(selectedVariation: ProductVariation): void {
    // Update URL for variant tracking without creating history entries
    const baseUrl = window.location.pathname.split('?')[0];
    if (selectedVariation.name) {
      const variantSlug = createVariantSlug(selectedVariation.name);
      const newUrl = `${baseUrl}?variant=${variantSlug}`;
      // Use replaceState to update URL without adding history entry
      window.history.replaceState({}, '', newUrl);
    }
  }

  private updateBisSection(
    variation: ProductVariation,
    inStock: boolean
  ): void {
    const bisSection = document.getElementById('back-in-stock-section');
    if (!bisSection) return;

    if (!inStock) {
      // Read the base title stored on the element so we don't need it in productData
      const productTitle = bisSection.dataset.productTitle ?? '';
      const label = variation.name
        ? `${productTitle} — ${variation.name}`
        : productTitle;

      // Update hidden fields for the newly selected OOS variant
      const variationIdInput = document.getElementById(
        'bis-variation-id'
      ) as HTMLInputElement | null;
      const productTitleInput = document.getElementById(
        'bis-product-title'
      ) as HTMLInputElement | null;
      if (variationIdInput) variationIdInput.value = variation.variationId;
      if (productTitleInput) productTitleInput.value = label;

      // Update the inline product name span in the description
      const labelEl = document.getElementById('bis-label-product');
      if (labelEl) labelEl.textContent = label;

      // Reset form state (in case user previously submitted for a different variant)
      const form = document.getElementById(
        'back-in-stock-form'
      ) as HTMLFormElement | null;
      const emailInput = document.getElementById(
        'bis-email'
      ) as HTMLInputElement | null;
      if (form) form.classList.remove('hidden');
      if (emailInput) emailInput.value = '';
      document.getElementById('bis-success')?.classList.add('hidden');
      document.getElementById('bis-error')?.classList.add('hidden');

      bisSection.classList.remove('hidden');
    } else {
      bisSection.classList.add('hidden');
    }
  }

  private handleAttributeSelection(attributeType: string, value: string): void {
    const target = this.resolveVariation(attributeType, value);
    if (!target) return; // value isn't on any variation; nothing to show

    // Adopt the target's full attribute set. When the exact combination
    // exists this equals the old selection plus the new value; when it
    // doesn't, the other attributes snap to the nearest real combination so
    // the chips, price, image, URL and back-in-stock form all describe the
    // same variation.
    const previous = this.selectedAttributes;
    this.selectedAttributes = { ...target.attributes };

    this.updateProductUI(target);
    this.updateAttributeButtonStates();

    const changedOthers = Object.keys(previous)
      .filter(
        (k) => k !== attributeType && previous[k] !== this.selectedAttributes[k]
      )
      .map((k) => previous[k]);
    this.announceSelection(
      target,
      changedOthers.length
        ? { unavailable: changedOthers, requested: value }
        : undefined
    );
  }

  private handleVariationSelection(variationId: string): void {
    const variation = this.productData.variations.find(
      (v) => v.variationId === variationId
    );
    if (variation) {
      this.updateProductUI(variation);
      this.announceSelection(variation);
    }
  }

  /**
   * Announce a user-driven selection to screen readers. Deliberately not
   * called from initialize()/handleCartUpdate() so page load and cart syncs
   * stay silent.
   */
  private announceSelection(
    variation: ProductVariation,
    snapped?: { unavailable: string[]; requested: string }
  ): void {
    const info = cart.getProductAvailability(
      this.productData.productId,
      variation.variationId,
      variation.quantity || 0
    );
    const selectedValues = Object.values(this.selectedAttributes).join(' ');
    const label = selectedValues || variation.name;

    this.uiManager.announceVariantChange({
      // When the requested combination doesn't exist, say what moved so a
      // screen-reader user isn't left wondering why another option changed.
      label: snapped
        ? `${label} (${snapped.unavailable.join(' ')} isn't offered in ${snapped.requested})`
        : label,
      price: variation.saleInfo?.salePrice ?? variation.price,
      info,
    });
  }

  private handleCartUpdate(): void {
    if (!this.currentVariation) return;

    const availabilityInfo = cart.getProductAvailability(
      this.productData.productId,
      this.currentVariation.variationId,
      this.currentVariation.quantity || 0
    );

    this.uiManager.updateAvailabilityDisplay(
      availabilityInfo,
      this.currentVariation.saleInfo
    );
    this.updateAttributeButtonStates();
  }

  private updateAttributeButtonStates(): void {
    this.uiManager.updateAttributeButtonStates(
      this.productData.availableAttributes,
      this.selectedAttributes,
      (attributeType: string, value: string): boolean => {
        // Same resolution a click uses, so a chip is only styled as out of
        // stock when selecting it would actually land on something unbuyable.
        const target = this.resolveVariation(attributeType, value);

        return Boolean(
          target?.inStock &&
          cart.canAddToCart(
            this.productData.productId,
            target.variationId,
            target.quantity || 0
          )
        );
      }
    );
  }

  public cleanup(): void {
    this.eventManager.cleanup();
    this.currentVariation = null;
    this.selectedAttributes = {};
  }
}
