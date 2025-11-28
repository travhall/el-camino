// src/lib/product/pdpUI.ts
import {
  getButtonText,
  isButtonDisabled,
  getDefaultQuantity,
  getMaxQuantity,
  isQuantityInputDisabled,
  ProductAvailabilityState,
  type ProductAvailabilityInfo,
} from "@/lib/square/types";
import { MoneyUtils } from "@/lib/square/money";

export interface ElementIds {
  priceDisplay?: string;
  originalPriceDisplay?: string;
  unitDisplay?: string;
  quantityInput?: string;
  addToCartButton?: string;
  decreaseButton?: string;
  increaseButton?: string;
  productImage?: string;
  imageContainer?: string;
  remainingCount?: string;
  cartQuantity?: string;
  inventoryStatus?: string;
}

export class PDPUIManager {
  private elements: {
    priceDisplay?: HTMLElement;
    originalPriceDisplay?: HTMLElement;
    unitDisplay?: HTMLElement;
    quantityInput?: HTMLInputElement;
    addToCartButton?: HTMLButtonElement;
    decreaseButton?: HTMLButtonElement;
    increaseButton?: HTMLButtonElement;
    productImage?: HTMLImageElement;
    imageContainer?: HTMLElement;
    remainingCount?: HTMLElement;
    cartQuantity?: HTMLElement;
    inventoryStatus?: HTMLElement;
  } = {};
  
  private elementIds?: ElementIds; // Store for recaching

  constructor(elementIds?: ElementIds) {
    this.elementIds = elementIds;
    this.cacheElements(elementIds);
  }

  private cacheElements(customIds?: ElementIds): void {
    const ids = {
      priceDisplay: customIds?.priceDisplay || 'price-display',
      originalPriceDisplay: customIds?.originalPriceDisplay || 'original-price-display',
      unitDisplay: customIds?.unitDisplay || 'unit-display',
      quantityInput: customIds?.quantityInput || 'quantity-input',
      addToCartButton: customIds?.addToCartButton || 'add-to-cart-button',
      decreaseButton: customIds?.decreaseButton || 'decrease-quantity',
      increaseButton: customIds?.increaseButton || 'increase-quantity',
      productImage: customIds?.productImage || 'product-image',
      imageContainer: customIds?.imageContainer || 'product-image-container',
      remainingCount: customIds?.remainingCount || 'remaining-count',
      cartQuantity: customIds?.cartQuantity || 'cart-quantity',
      inventoryStatus: customIds?.inventoryStatus || 'inventory-status',
    };

    const productImage = document.getElementById(ids.productImage) as HTMLImageElement;
    const imageContainer = document.getElementById(ids.imageContainer);

    this.elements = {
      priceDisplay: document.getElementById(ids.priceDisplay) || undefined,
      originalPriceDisplay: document.getElementById(ids.originalPriceDisplay) || undefined,
      unitDisplay: document.getElementById(ids.unitDisplay) || undefined,
      quantityInput: (document.getElementById(ids.quantityInput) as HTMLInputElement) || undefined,
      addToCartButton: (document.getElementById(ids.addToCartButton) as HTMLButtonElement) || undefined,
      decreaseButton: (document.getElementById(ids.decreaseButton) as HTMLButtonElement) || undefined,
      increaseButton: (document.getElementById(ids.increaseButton) as HTMLButtonElement) || undefined,
      productImage: productImage || undefined,
      imageContainer: imageContainer || undefined,
      remainingCount: document.getElementById(ids.remainingCount) || undefined,
      cartQuantity: document.getElementById(ids.cartQuantity) || undefined,
      inventoryStatus: document.getElementById(ids.inventoryStatus) || undefined,
    };
  }

  updateAvailabilityDisplay(info: ProductAvailabilityInfo, saleInfo?: any): void {
    this.updateQuantityControls(info);
    this.updateAddToCartButton(info);
    this.updateImageOverlay(info, saleInfo);
    this.updateInventoryDisplay(info);
  }

  updateQuantityControls(info: ProductAvailabilityInfo): void {
    // Re-cache elements in case they were cloned/replaced
    this.cacheElements(this.elementIds); // Use stored IDs

    const { quantityInput, decreaseButton, increaseButton } = this.elements;
    if (!quantityInput) return;

    const defaultQty = getDefaultQuantity(info.state);
    const maxQty = getMaxQuantity(info);
    const isDisabled = isQuantityInputDisabled(info.state);

    quantityInput.value = defaultQty.toString();
    quantityInput.max = maxQty.toString();
    quantityInput.disabled = isDisabled;

    if (decreaseButton) {
      decreaseButton.disabled = isDisabled || defaultQty <= 1;
    }
    if (increaseButton) {
      increaseButton.disabled = isDisabled || defaultQty >= maxQty;
    }
  }

  updateAddToCartButton(info: ProductAvailabilityInfo): void {
    const { addToCartButton } = this.elements;
    if (!addToCartButton) return;

    addToCartButton.textContent = getButtonText(info.state);
    addToCartButton.disabled = isButtonDisabled(info.state);

    if (isButtonDisabled(info.state)) {
      addToCartButton.classList.add("opacity-50", "cursor-not-allowed");
    } else {
      addToCartButton.classList.remove("opacity-50", "cursor-not-allowed");
    }
  }

  updateImageOverlay(info: ProductAvailabilityInfo, saleInfo?: any): void {
    const { imageContainer, productImage } = this.elements;

    if (!imageContainer) return;

    const existingOverlay = imageContainer.querySelector('[data-overlay]');
    if (existingOverlay) existingOverlay.remove();

    if (info.state === ProductAvailabilityState.OUT_OF_STOCK) {
      const overlay = document.createElement("div");
      overlay.setAttribute('data-overlay', 'stock');
      overlay.className =
        "absolute top-0 left-0 bg-state-error-surface text-state-error-text px-3 py-2 text-md font-bold rounded-br-sm";
      overlay.textContent = getButtonText(info.state);
      imageContainer.appendChild(overlay);

      if (productImage) productImage.classList.add("opacity-75");
    } else if (saleInfo) {
      const discountPercent = saleInfo.discountPercent;
      const overlay = document.createElement("div");
      overlay.setAttribute('data-overlay', 'sale');
      overlay.className =
        "absolute top-0 left-0 bg-state-success-surface text-state-success-text px-3 py-2 text-md font-bold rounded-br-sm";
      overlay.textContent = `${discountPercent}% Off`;
      imageContainer.appendChild(overlay);

      if (productImage) productImage.classList.remove("opacity-75");
    } else {
      if (productImage) productImage.classList.remove("opacity-75");
    }
  }

  updateInventoryDisplay(info: ProductAvailabilityInfo): void {
    const { remainingCount, cartQuantity, inventoryStatus } = this.elements;

    if (remainingCount) {
      remainingCount.textContent = `${info.remaining} available`;
    }

    if (cartQuantity) {
      if (info.inCart > 0) {
        cartQuantity.textContent = `( ${info.inCart} in cart )`;
        cartQuantity.classList.remove("hidden");
      } else {
        cartQuantity.classList.add("hidden");
      }
    }

    if (inventoryStatus) {
      if (info.state === ProductAvailabilityState.OUT_OF_STOCK) {
        inventoryStatus.innerHTML = `
          <p class="mt-2 text-sm">
            This item is currently out of stock
          </p>
        `;
      } else {
        inventoryStatus.innerHTML = "";
      }
    }
  }

  updatePriceDisplay(price: number, options?: { unit?: string; saleInfo?: any }): void {
    const { priceDisplay, originalPriceDisplay, unitDisplay } = this.elements;
    if (!priceDisplay) return;

    const saleInfo = options?.saleInfo;
    const unit = options?.unit;

    if (saleInfo) {
      // Show original price with strikethrough
      if (originalPriceDisplay) {
        originalPriceDisplay.textContent = MoneyUtils.format(
          MoneyUtils.fromFloat(saleInfo.originalPrice)
        );
        originalPriceDisplay.classList.remove("hidden");
      }
      // Show sale price
      priceDisplay.textContent = MoneyUtils.format(
        MoneyUtils.fromFloat(saleInfo.salePrice)
      );
    } else {
      // Regular price display
      const formattedPrice = MoneyUtils.format(MoneyUtils.fromFloat(price));
      priceDisplay.textContent = formattedPrice;
      
      // Hide original price if shown
      if (originalPriceDisplay) {
        originalPriceDisplay.classList.add("hidden");
      }
    }

    // Handle unit display
    if (unit && unitDisplay) {
      unitDisplay.textContent = unit;
      unitDisplay.classList.remove("hidden");
    } else if (unitDisplay) {
      unitDisplay.classList.add("hidden");
    }
  }

  updateProductImage(imageUrl: string): void {
    const { productImage } = this.elements;
    
    if (!productImage || !imageUrl) return;

    productImage.src = imageUrl;
    
    // Update srcset if present (Netlify Image CDN)
    if (productImage.hasAttribute('srcset')) {
      const sizes = [320, 640, 768, 1024];
      const srcsetParts = sizes.map(size => {
        const params = new URLSearchParams({
          url: imageUrl,
          w: size.toString(),
          q: '85',
          fit: 'cover',
          h: size.toString()
        });
        return `/.netlify/images?${params.toString()} ${size}w`;
      });
      
      productImage.setAttribute('srcset', srcsetParts.join(', '));
    }
  }

  updateButtonProductData(productData: any): void {
    const { addToCartButton } = this.elements;
    if (addToCartButton) {
      addToCartButton.dataset.product = JSON.stringify(productData);
    }
  }

  updateAttributeButtonStates(
    availableAttributes: Record<string, string[]>,
    selectedAttributes: Record<string, string>,
    canAddToCartFn: (attributeType: string, value: string) => boolean
  ): void {
    Object.keys(availableAttributes).forEach((attributeType) => {
      const buttons = document.querySelectorAll(
        `[data-attribute-type="${attributeType}"]`
      );

      buttons.forEach((button) => {
        const btn = button as HTMLButtonElement;
        const value = btn.dataset.attributeValue;
        if (!value) return;

        const isAvailable = canAddToCartFn(attributeType, value);
        const isSelected = selectedAttributes[attributeType] === value;

        // Update availability styling
        if (!isAvailable) {
          btn.classList.add("opacity-50");
        } else {
          btn.classList.remove("opacity-50");
        }

        // Update selected state
        if (isSelected) {
          btn.classList.remove(
            "bg-(--ui-input-surface)",
            "text-(--ui-input-text)",
            "border-(--ui-input-border)/50"
          );
          btn.classList.add(
            "bg-(--ui-button-surface)",
            "text-(--ui-button-text)",
            "border-(--ui-button-border)/50"
          );
        } else {
          btn.classList.add(
            "bg-(--ui-input-surface)",
            "text-(--ui-input-text)",
            "border-(--ui-input-border)/50"
          );
          btn.classList.remove(
            "bg-(--ui-button-surface)",
            "text-(--ui-button-text)",
            "border-(--ui-button-border)/50"
          );
        }
      });
    });
  }

  updateVariationButtonStates(
    variationButtons: NodeListOf<Element>,
    selectedVariationId: string
  ): void {
    variationButtons.forEach((button) => {
      const btn = button as HTMLButtonElement;
      const variationId = btn.dataset.variationId;

      if (variationId === selectedVariationId) {
        btn.classList.add(
          "bg-(--ui-button-surface)",
          "text-(--ui-button-text)",
          "border-(--ui-button-border)/50"
        );
        btn.classList.remove(
          "bg-(--ui-input-surface)",
          "text-(--ui-input-text)",
          "border-(--ui-input-border)/50"
        );
      } else {
        btn.classList.remove(
          "bg-(--ui-button-surface)",
          "text-(--ui-button-text)",
          "border-(--ui-button-border)/50"
        );
        btn.classList.add(
          "bg-(--ui-input-surface)",
          "text-(--ui-input-text)",
          "border-(--ui-input-border)/50"
        );
      }
    });
  }

  resetQuantityToOne(): void {
    const { quantityInput } = this.elements;
    if (quantityInput) {
      quantityInput.value = "1";
    }
  }

  getQuantityValue(): number {
    const { quantityInput } = this.elements;
    return quantityInput ? parseInt(quantityInput.value, 10) || 1 : 1;
  }

  setButtonText(text: string): void {
    const { addToCartButton } = this.elements;
    if (addToCartButton) {
      addToCartButton.textContent = text;
    }
  }

  refreshElements(elementIds?: ElementIds): void {
    // Re-cache elements after DOM changes
    this.cacheElements(elementIds);
  }
}
