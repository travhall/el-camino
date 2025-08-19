// src/lib/product/pdpController.ts
import { cart } from "@/lib/cart";
import { findVariationByAttributes } from "@/lib/square/variationParser";
import { createVariantSlug } from "@/lib/square/slugUtils";
import {
  processSquareError,
  logError,
  createError,
  ErrorType,
} from "@/lib/square/errorUtils";
import { PDPUIManager } from "./pdpUI";
import { PDPEventManager, type ProductPageData } from "./pdpEvents";
import { getNavigationManager } from "@/lib/navigation/NavigationManager";

export class PDPController {
  private selectedAttributes: Record<string, string> = {};
  private currentVariation: any = null;
  private uiManager: PDPUIManager;
  private eventManager: PDPEventManager;
  private isInitialLoad: boolean = true; // Track if this is initial page load

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
    this.currentVariation = this.productData.variations.find(
      (v) => v.variationId === this.productData.selectedVariationId
    );

    if (this.currentVariation?.attributes) {
      this.selectedAttributes = { ...this.currentVariation.attributes };
    }

    // Setup all event handlers
    this.eventManager.setupAllEventHandlers();

    // Initialize UI state without updating URL (initial page load)
    if (this.currentVariation) {
      console.log('[PDPController] Initializing UI without URL update for:', this.currentVariation.name);
      this.updateUIOnly(this.currentVariation);
    }

    this.updateAttributeButtonStates();
    
    // Mark initial load complete after everything is set up
    this.isInitialLoad = false;
  }

  private updateCurrentVariation(): void {
    try {
      const matchingVariation = findVariationByAttributes(
        this.productData.variations,
        this.selectedAttributes
      );

      if (matchingVariation) {
        this.currentVariation = matchingVariation;
        
        // For user interactions, update both UI and URL
        if (!this.isInitialLoad) {
          this.updateVariantUrl(matchingVariation);
        }
        
        // Always update UI regardless of initial load status
        this.updateUIOnly(matchingVariation);
      } else {
        this.showOutOfStockState();
      }
    } catch (error) {
      const appError = processSquareError(error, "updateCurrentVariation");
      logError(appError);
    }
  }

  private updateUIOnly(variation: any): void {
    if (!variation) return;

    // Use UI manager for all display updates
    const availabilityInfo = cart.getProductAvailability(
      this.productData.productId,
      variation.variationId,
      variation.quantity || 0
    );

    this.uiManager.updateAvailabilityDisplay(availabilityInfo);
    this.uiManager.updatePriceDisplay(variation.price, variation.unit);

    if (variation.image) {
      this.uiManager.updateProductImage(variation.image);
    }

    this.updateButtonProductData(variation);
  }

  private updateProductUI(variation: any): void {
    if (!variation) return;

    this.currentVariation = variation;
    
    // Only update URL for user interactions, not initial page load
    if (!this.isInitialLoad) {
      this.updateVariantUrl(variation);
    }

    // Always update UI
    this.updateUIOnly(variation);
  }

  private updateButtonProductData(variation: any): void {
    const button = document.getElementById(
      "add-to-cart-button"
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
        "Failed to update button product data",
        {
          source: "updateButtonProductData",
          originalError: error,
        }
      );
      logError(appError);
    }
  }

  private updateVariantUrl(selectedVariation: any): void {
    // TEMPORARILY DISABLED - causing double back button issue
    // TODO: Re-implement variant URL updates after navigation is stable
    console.log('[PDPController] Variant URL update disabled for navigation fix');
    return;
    
    console.log('[PDPController] updateVariantUrl called for user interaction:', selectedVariation.name);
    
    const baseUrl = window.location.pathname.split("?")[0];
    if (selectedVariation.name) {
      const variantSlug = createVariantSlug(selectedVariation.name);
      const newUrl = `${baseUrl}?variant=${variantSlug}`;
      
      // Use navigation manager for coordinated URL updates
      const navManager = getNavigationManager();
      if (navManager?.isEnabled()) {
        // Always use pushState for user interactions (this method only called for user interactions now)
        navManager.updateURL(newUrl, false);
      } else {
        // Fallback: always pushState for user interactions
        window.history.pushState({}, "", newUrl);
      }
    }
  }

  private showOutOfStockState(): void {
    if (!this.currentVariation) return;

    this.uiManager.updatePriceDisplay(
      this.currentVariation.price,
      this.currentVariation.unit
    );

    const outOfStockInfo = cart.getProductAvailability(
      this.productData.productId,
      "out-of-stock",
      0
    );
    this.uiManager.updateAvailabilityDisplay(outOfStockInfo);
  }

  private handleAttributeSelection(attributeType: string, value: string): void {
    this.selectedAttributes[attributeType] = value;
    this.isInitialLoad = false; // Ensure this is treated as user interaction
    this.updateCurrentVariation();
    this.updateAttributeButtonStates();
  }

  private handleVariationSelection(variationId: string): void {
    const variation = this.productData.variations.find(
      (v) => v.variationId === variationId
    );
    if (variation) {
      this.isInitialLoad = false; // Ensure this is treated as user interaction
      this.updateProductUI(variation);
    }
  }

  private handleCartUpdate(): void {
    if (!this.currentVariation) return;

    const availabilityInfo = cart.getProductAvailability(
      this.productData.productId,
      this.currentVariation.variationId,
      this.currentVariation.quantity || 0
    );

    this.uiManager.updateAvailabilityDisplay(availabilityInfo);
    this.updateAttributeButtonStates();
  }

  private updateAttributeButtonStates(): void {
    this.uiManager.updateAttributeButtonStates(
      this.productData.availableAttributes,
      this.selectedAttributes,
      (attributeType: string, value: string): boolean => {
        const testAttributes = {
          ...this.selectedAttributes,
          [attributeType]: value,
        };
        const matchingVariation = findVariationByAttributes(
          this.productData.variations,
          testAttributes
        );

        return Boolean(
          matchingVariation?.inStock &&
            cart.canAddToCart(
              this.productData.productId,
              matchingVariation.variationId,
              matchingVariation.quantity || 0
            )
        );
      }
    );
  }

  public cleanup(): void {
    this.eventManager.cleanup();
    this.currentVariation = null;
    this.selectedAttributes = {};
    this.isInitialLoad = true; // Reset for next instance
  }
}
