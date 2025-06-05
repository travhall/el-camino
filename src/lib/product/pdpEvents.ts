// src/lib/product/pdpEvents.ts
import { cart } from "@/lib/cart";
import { PDPUIManager } from "./pdpUI";
import {
  processSquareError,
  logError,
  createError,
  ErrorType,
} from "@/lib/square/errorUtils";

// Global declarations
declare global {
  interface Window {
    showLocationModal(): void;
  }
}

export interface ProductPageData {
  variations: any[];
  availableAttributes: Record<string, string[]>;
  selectedVariationId: string;
  productId: string;
}

export class PDPEventManager {
  private isProcessing = false;

  constructor(
    private uiManager: PDPUIManager,
    private productData: ProductPageData,
    private callbacks: {
      onAttributeSelection: (attributeType: string, value: string) => void;
      onVariationSelection: (variationId: string) => void;
      onCartUpdate: () => void;
    }
  ) {}

  setupAllEventHandlers(): void {
    this.setupAttributeButtons();
    this.setupQuantityControls();
    this.setupFallbackVariationButtons();
    this.setupAddToCartHandler();
    this.setupCartEventListeners();
    this.setupLocationModal();
  }

  private setupAttributeButtons(): void {
    const attributeButtons = document.querySelectorAll(".attribute-button");
    attributeButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        if (btn.disabled) return;

        const attributeType = btn.dataset.attributeType;
        const attributeValue = btn.dataset.attributeValue;

        if (attributeType && attributeValue) {
          this.callbacks.onAttributeSelection(attributeType, attributeValue);
        }
      });
    });
  }

  private setupQuantityControls(): void {
    const quantityInput = document.getElementById(
      "quantity-input"
    ) as HTMLInputElement;
    const decreaseButton = document.getElementById(
      "decrease-quantity"
    ) as HTMLButtonElement;
    const increaseButton = document.getElementById(
      "increase-quantity"
    ) as HTMLButtonElement;

    if (!quantityInput || !decreaseButton || !increaseButton) return;

    increaseButton.addEventListener("click", () => {
      const currentValue = parseInt(quantityInput.value, 10) || 0;
      const maxValue = parseInt(quantityInput.max, 10) || 0;

      if (currentValue < maxValue) {
        quantityInput.value = String(currentValue + 1);
        this.updateQuantityButtonStates(
          quantityInput,
          decreaseButton,
          increaseButton
        );
      }
    });

    decreaseButton.addEventListener("click", () => {
      const currentValue = parseInt(quantityInput.value, 10) || 0;
      if (currentValue > 1) {
        quantityInput.value = String(currentValue - 1);
        this.updateQuantityButtonStates(
          quantityInput,
          decreaseButton,
          increaseButton
        );
      }
    });

    quantityInput.addEventListener("change", () => {
      let value = parseInt(quantityInput.value, 10);
      const max = parseInt(quantityInput.max, 10) || 0;

      if (isNaN(value) || value < 1) value = 1;
      else if (value > max) value = max;

      quantityInput.value = String(value);
      this.updateQuantityButtonStates(
        quantityInput,
        decreaseButton,
        increaseButton
      );
    });
  }

  private updateQuantityButtonStates(
    quantityInput: HTMLInputElement,
    decreaseButton: HTMLButtonElement,
    increaseButton: HTMLButtonElement
  ): void {
    const value = parseInt(quantityInput.value, 10);
    const max = parseInt(quantityInput.max, 10) || 0;

    decreaseButton.disabled = value <= 1;
    increaseButton.disabled = value >= max;
  }

  private setupFallbackVariationButtons(): void {
    const variationButtons = document.querySelectorAll("[data-variation-id]");
    variationButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const btn = button as HTMLButtonElement;
        if (btn.disabled) return;

        const variationId = btn.dataset.variationId;
        if (variationId) {
          this.callbacks.onVariationSelection(variationId);
          this.uiManager.updateVariationButtonStates(
            variationButtons,
            variationId
          );
        }
      });
    });
  }

  private setupAddToCartHandler(): void {
    const button = document.getElementById("add-to-cart-button");
    if (!button) return;

    // Clone button to remove existing listeners
    const newButton = button.cloneNode(true) as HTMLElement;
    button.parentNode?.replaceChild(newButton, button);

    // Refresh UI manager elements since we replaced the button
    this.uiManager.refreshElements();

    newButton.addEventListener("click", async () => {
      await this.handleAddToCart(newButton as HTMLButtonElement);
    });
  }

  private async handleAddToCart(button: HTMLButtonElement): Promise<void> {
    if (button.disabled || this.isProcessing) return;

    this.isProcessing = true;
    const originalText = button.textContent || "Add to Cart";
    this.uiManager.setButtonText("Adding...");

    try {
      const productData = button.dataset.product;
      if (!productData) throw new Error("No product data found");

      const product = JSON.parse(productData);
      const quantity = this.uiManager.getQuantityValue();

      if (isNaN(quantity) || quantity < 1) {
        window.showNotification("Please enter a valid quantity", "error");
        return;
      }

      // Validate with cart system
      const variation = this.productData.variations.find(
        (v) => v.variationId === product.variationId
      );
      const totalAvailable = variation?.quantity || 0;

      if (
        !cart.canAddToCart(
          this.productData.productId,
          product.variationId,
          totalAvailable,
          quantity
        )
      ) {
        window.showNotification("Cannot add that quantity to cart", "error");
        return;
      }

      product.quantity = quantity;
      const result = await cart.addItem(product);

      if (result.success) {
        window.showNotification(
          result.message || `Added ${quantity} to cart`,
          "success"
        );
        this.uiManager.resetQuantityToOne();
        this.callbacks.onCartUpdate();
      } else {
        window.showNotification(
          result.message || "Failed to add to cart",
          "error"
        );
      }
    } catch (error) {
      const appError = processSquareError(error, "addToCart");
      logError(appError);
      window.showNotification("Failed to add to cart", "error");
    } finally {
      this.isProcessing = false;
      this.uiManager.setButtonText(originalText);
    }
  }

  private setupCartEventListeners(): void {
    window.addEventListener("cartUpdated", () => {
      this.callbacks.onCartUpdate();
    });
  }

  private setupLocationModal(): void {
    const locationLink = document.getElementById("location-hours-link");
    if (locationLink) {
      locationLink.addEventListener("click", () => {
        window.showLocationModal();
      });
    }
  }

  cleanup(): void {
    // Reset processing state for next page
    this.isProcessing = false;
  }
}
