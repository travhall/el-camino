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

export class PDPUIManager {
  private elements: {
    priceDisplay?: HTMLElement;
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

  constructor() {
    this.cacheElements();
  }

  private cacheElements(): void {
    const productImage = document.getElementById(
      "product-image"
    ) as HTMLImageElement;

    this.elements = {
      priceDisplay: document.getElementById("price-display") || undefined,
      quantityInput:
        (document.getElementById("quantity-input") as HTMLInputElement) ||
        undefined,
      addToCartButton:
        (document.getElementById("add-to-cart-button") as HTMLButtonElement) ||
        undefined,
      decreaseButton:
        (document.getElementById("decrease-quantity") as HTMLButtonElement) ||
        undefined,
      increaseButton:
        (document.getElementById("increase-quantity") as HTMLButtonElement) ||
        undefined,
      productImage: productImage || undefined,
      imageContainer: productImage?.parentElement || undefined,
      remainingCount: document.getElementById("remaining-count") || undefined,
      cartQuantity: document.getElementById("cart-quantity") || undefined,
      inventoryStatus: document.getElementById("inventory-status") || undefined,
    };
  }

  updateAvailabilityDisplay(info: ProductAvailabilityInfo): void {
    this.updateQuantityControls(info);
    this.updateAddToCartButton(info);
    this.updateImageOverlay(info);
    this.updateInventoryDisplay(info);
  }

  updateQuantityControls(info: ProductAvailabilityInfo): void {
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

  updateImageOverlay(info: ProductAvailabilityInfo): void {
    const { imageContainer, productImage } = this.elements;

    // Remove existing overlay
    const stockOverlay = document.getElementById("stock-overlay");
    if (stockOverlay) stockOverlay.remove();

    if (
      info.state === ProductAvailabilityState.OUT_OF_STOCK &&
      imageContainer
    ) {
      const overlay = document.createElement("div");
      overlay.id = "stock-overlay";
      overlay.className =
        "absolute top-0 left-0 bg-state-error-surface text-state-error-text px-3 py-2 text-md font-bold rounded-sm";
      overlay.textContent = getButtonText(info.state);
      imageContainer.appendChild(overlay);

      if (productImage) productImage.classList.add("opacity-75");
    } else if (productImage) {
      productImage.classList.remove("opacity-75");
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

  updatePriceDisplay(price: number, unit?: string): void {
    const { priceDisplay } = this.elements;
    if (!priceDisplay) return;

    const formattedPrice = MoneyUtils.format(MoneyUtils.fromFloat(price));

    if (unit) {
      priceDisplay.innerHTML = `${formattedPrice} <span class="text-xl">${unit}</span>`;
    } else {
      priceDisplay.textContent = formattedPrice;
    }
  }

  updateProductImage(imageUrl: string): void {
    const { productImage } = this.elements;
    if (productImage && imageUrl) {
      productImage.src = imageUrl;
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
            "bg-ui-input-surface",
            "text-ui-input-text",
            "border-ui-input-border/50"
          );
          btn.classList.add(
            "bg-ui-button-surface",
            "text-ui-button-text",
            "border-ui-button-border/50"
          );
        } else {
          btn.classList.add(
            "bg-ui-input-surface",
            "text-ui-input-text",
            "border-ui-input-border/50"
          );
          btn.classList.remove(
            "bg-ui-button-surface",
            "text-ui-button-text",
            "border-ui-button-border/50"
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
          "bg-ui-button-surface",
          "text-ui-button-text",
          "border-ui-button-border/50"
        );
        btn.classList.remove(
          "bg-ui-input-surface",
          "text-ui-input-text",
          "border-ui-input-border/50"
        );
      } else {
        btn.classList.remove(
          "bg-ui-button-surface",
          "text-ui-button-text",
          "border-ui-button-border/50"
        );
        btn.classList.add(
          "bg-ui-input-surface",
          "text-ui-input-text",
          "border-ui-input-border/50"
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

  refreshElements(): void {
    // Re-cache elements after DOM changes
    this.cacheElements();
  }
}
