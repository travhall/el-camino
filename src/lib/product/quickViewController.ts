// src/lib/product/quickViewController.ts
// Extracted from QuickView.astro's <script> block for testability (mirrors pdpController.ts).

import { navigate } from "astro:transitions/client";
import { cart } from "@/lib/cart";
import {
  createInitialSelectionState,
  getAttributeDisplayName,
  findVariationByAttributes,
} from "@/lib/square/variationParser";
import { processClientError, logError } from "@/lib/square/errorUtils";
import type { Product, ProductVariation } from "@/lib/square/types";
import { PDPUIManager } from "@/lib/product/pdpUI";
import { showNotification } from "@/lib/events";

// QuickView Controller - Uses centralized PDPUIManager
export class QuickViewController {
  private static instance: QuickViewController;
  private currentProduct: Product | null = null;
  private lastProductId: string | null = null;
  private selectedAttributes: Record<string, string> = {};
  private currentVariation: ProductVariation | null = null;
  private productData: any = null;
  private isProcessing: boolean = false;
  private uiManager!: PDPUIManager;

  static getInstance(): QuickViewController {
    if (!QuickViewController.instance) {
      QuickViewController.instance = new QuickViewController();
    }
    return QuickViewController.instance;
  }

  private initializeUIManager(): void {
    // Initialize UI manager with QuickView element IDs
    this.uiManager = new PDPUIManager({
      priceDisplay: "quick-view-price",
      originalPriceDisplay: "quick-view-original-price",
      unitDisplay: "quick-view-unit",
      quantityInput: "quick-view-quantity",
      addToCartButton: "quick-view-add-to-cart",
      decreaseButton: "quick-view-decrease",
      increaseButton: "quick-view-increase",
      productImage: "quick-view-image",
      imageContainer: "quick-view-image-container",
      remainingCount: "quick-view-remaining-count",
      cartQuantity: "quick-view-cart-quantity",
    });
  }

  async openQuickView(
    productId: string,
    preferredVariationId?: string,
  ): Promise<void> {
    this.lastProductId = productId;
    try {
      this.showLoading();
      this.openModal();

      // Abort after 8 s so a hung request shows the error state instead of a
      // permanent spinner
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 8000);

      let response: Response;
      try {
        response = await fetch(`/api/quick-view-product?id=${productId}`, {
          signal: abortController.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const product = await response.json();
      if (!product) {
        throw new Error("Product not found");
      }

      // Eagerly prefetch the PDP while the user browses Quick View so that
      // "View Full Details" loads from cache instead of waiting on cold SSR.
      if (product.url) {
        const prefetchLink = document.createElement("link");
        prefetchLink.rel = "prefetch";
        prefetchLink.href = product.url;
        document.head.appendChild(prefetchLink);
      }

      this.currentProduct = product;
      this.showProduct(); // Show DOM first
      this.initializeProduct(product, preferredVariationId); // Then initialize with UI manager available
    } catch (error) {
      const appError = processClientError(error, "openQuickView");
      logError(appError);
      this.showError();
    }
  }

  private initializeProduct(
    product: Product,
    preferredVariationId?: string,
  ): void {
    // EXACTLY mirror PDP initialization
    let defaultVariationId = product.variationId;
    let variations = product.variations || [];

    // If a preferred variation was requested (e.g. from the Sale page), honour it
    // as long as it exists and is in stock; otherwise fall through to normal logic.
    if (preferredVariationId) {
      const preferred = variations.find(
        (v) => v.variationId === preferredVariationId,
      );
      if (preferred?.inStock) {
        defaultVariationId = preferredVariationId;
      }
    }

    // Find first in-stock variation if default is out of stock (PDP pattern)
    if (variations.length > 0) {
      const defaultIsInStock = variations.find(
        (v) => v.variationId === defaultVariationId,
      )?.inStock;
      if (!defaultIsInStock) {
        const firstInStockVariation = variations.find((v) => v.inStock);
        if (firstInStockVariation) {
          defaultVariationId = firstInStockVariation.variationId;
        }
      }
    }

    // Create initial selection state using PDP parser
    const selectionState = createInitialSelectionState(variations);

    // Mirror PDP fallback image assignment: if product has multiple images and
    // no color attribute exists, the images are multi-angle shots shared by all
    // variations (e.g. a deck in multiple sizes) — assign them to variation.images.
    if (product.images && product.images.length > 1) {
      const colorKey = Object.keys(variations[0]?.attributes ?? {}).find(
        (k) => k.toLowerCase() === "color" || k.toLowerCase() === "colour",
      );
      if (!colorKey) {
        for (const v of variations) {
          if (!v.images || v.images.length === 0) {
            v.images = product.images;
            if (!v.image) v.image = product.images[0];
          }
        }
      }
    }

    // Set up product data structure (matching PDP)
    this.productData = {
      variations: variations,
      availableAttributes: selectionState.availableAttributes,
      selectedVariationId: defaultVariationId,
      productId: product.id,
    };

    // Initialize current variation and attributes (PDP pattern)
    this.currentVariation =
      variations.find((v) => v.variationId === defaultVariationId) ||
      variations[0] ||
      null;

    if (this.currentVariation?.attributes) {
      this.selectedAttributes = { ...this.currentVariation.attributes };
    }

    this.renderProduct(product);
    this.renderVariations(product);

    // Initialize UI manager after DOM elements are created
    this.initializeUIManager();

    this.updateProductUI();
    this.updateAttributeButtonStates();
  }

  // Route any external image URL through Netlify Image CDN for compression,
  // format negotiation (AVIF/WebP), and edge caching — covers squarecdn.com,
  // s3.amazonaws.com, and any other Square storage backend.
  private optimizeImageSrc(src: string, size: number): string {
    if (!src || src.startsWith("/") || src.startsWith("data:")) return src;
    const p = new URLSearchParams({
      url: src,
      w: String(size),
      h: String(size),
      fit: "cover",
      q: "80",
    });
    return `/.netlify/images?${p.toString()}`;
  }

  // Build/refresh the thumbnail strip from an array of image URLs.
  // Hides the strip when there is only one image.
  private renderGallery(images: string[], activeImageSrc: string): void {
    const container = document.getElementById("quick-view-thumbnails");
    if (!container) return;

    if (!images || images.length <= 1) {
      container.classList.add("hidden");
      container.classList.remove("flex");
      container.innerHTML = "";
      return;
    }

    container.innerHTML = images
      .map((src, i) => {
        const thumbSrc = this.optimizeImageSrc(src, 64);
        const isActive = src === activeImageSrc || i === 0;
        return `<button
          type="button"
          class="quick-view-thumb shrink-0 w-14 h-14 border-2 overflow-hidden bg-(--surface-secondary) transition-all ${isActive ? "border-(--ui-button-border) opacity-100" : "border-(--border-secondary) opacity-60 hover:opacity-100 hover:border-(--border-primary)"}"
          data-gallery-src="${src}"
          aria-label="View image ${i + 1}"
          aria-pressed="${isActive ? "true" : "false"}"
        >
          <img src="${thumbSrc}" alt="Product image ${i + 1}" class="w-full h-full object-cover" loading="${i < 3 ? "eager" : "lazy"}" width="56" height="56" />
        </button>`;
      })
      .join("");

    container.classList.remove("hidden");
    container.classList.add("flex");
  }

  // Sync the active thumbnail highlight when the main image changes
  // (e.g. on variation switch).
  private setActiveThumbnail(imageUrl: string): void {
    const container = document.getElementById("quick-view-thumbnails");
    if (!container) return;

    container
      .querySelectorAll<HTMLButtonElement>(".quick-view-thumb")
      .forEach((t) => {
        const isActive = t.dataset.gallerySrc === imageUrl;
        t.classList.toggle("border-(--ui-button-border)", isActive);
        t.classList.toggle("opacity-100", isActive);
        t.classList.toggle("border-(--border-secondary)", !isActive);
        t.classList.toggle("opacity-60", !isActive);
        t.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
  }

  private renderProduct(product: Product): void {
    const image = document.getElementById(
      "quick-view-image",
    ) as HTMLImageElement;
    if (image) {
      // Reset opacity and restore placeholder for the new product
      image.style.opacity = "0";
      const placeholder = document.getElementById(
        "quick-view-image-placeholder",
      );
      if (placeholder) placeholder.style.display = "block";

      // Reveal image and hide placeholder once loaded — replaces the
      // former inline onload/onerror HTML attributes (removed for CSP).
      image.onload = () => {
        image.style.opacity = "0.9";
        if (placeholder) placeholder.style.display = "none";
      };
      image.onerror = () => {
        image.style.opacity = "1";
        if (placeholder) placeholder.style.display = "none";
      };

      image.src = this.optimizeImageSrc(product.image, 400);
      image.alt = product.title;
    }

    const brand = document.getElementById("quick-view-brand");
    if (product.brand && brand) {
      brand.textContent = product.brand;
      brand.classList.remove("hidden");
    } else if (brand) {
      brand.classList.add("hidden");
    }

    const title = document.getElementById("quick-view-title-text");
    if (title) title.textContent = product.title;

    const description = document.getElementById("quick-view-description");
    if (description) {
      if (product.description) {
        description.textContent = product.description;
        description.classList.remove("hidden");
      } else {
        description.textContent = "";
        description.classList.add("hidden");
      }
    }

    this.updateViewDetailsButton(product);
  }

  private renderVariations(product: Product): void {
    if (!product.variations) return;

    // Use existing variation parser - even for single variations
    const selectionState = createInitialSelectionState(product.variations);
    const container = document.getElementById("quick-view-attributes");
    if (!container) return;

    container.innerHTML = "";

    const attributeTypes = Object.keys(selectionState.availableAttributes);

    // EXACTLY mirror PDP: Multi-variation products show all attribute types;
    // single-value attributes render as non-interactive spans, multi-value as buttons.
    if (product.variations.length > 1) {
      attributeTypes.forEach((attributeType) => {
        const attributeValues =
          selectionState.availableAttributes[attributeType];
        const displayName = getAttributeDisplayName(attributeType);
        const isSingleValue = attributeValues.length === 1;

        const section = document.createElement("div");
        section.className = "mt-4";

        const heading = document.createElement("h4");
        heading.className =
          "text-sm font-medium text-(--content-heading) mb-2";
        heading.textContent = displayName;

        const buttonContainer = document.createElement("div");
        buttonContainer.className = "flex flex-wrap gap-2";

        if (isSingleValue) {
          const span = document.createElement("span");
          span.className =
            "px-2.5 py-1.5 border rounded-sm text-sm cursor-default bg-(--ui-variant-selected-surface) text-(--ui-variant-selected-text) border-(--ui-variant-selected-border)";
          span.setAttribute(
            "aria-label",
            `${displayName}: ${attributeValues[0]}`,
          );
          span.textContent = attributeValues[0];
          buttonContainer.appendChild(span);
        } else {
          attributeValues.forEach((value) => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.attributeType = attributeType;
            button.dataset.attributeValue = value;
            button.textContent = value;
            button.className =
              "px-2.5 py-1.5 border rounded-sm text-sm cursor-pointer bg-(--ui-input-surface) text-(--ui-input-text) border-(--ui-input-border)/50";

            button.addEventListener("click", () => {
              this.handleAttributeSelection(attributeType, value);
            });

            buttonContainer.appendChild(button);
          });
        }

        section.appendChild(heading);
        section.appendChild(buttonContainer);
        container.appendChild(section);
      });
    }

    // EXACTLY mirror PDP: Single-variation attributes as non-interactive styled spans
    if (product.variations.length === 1 && attributeTypes.length > 0) {
      attributeTypes.forEach((attributeType) => {
        const attributeValues =
          selectionState.availableAttributes[attributeType];
        const displayName = getAttributeDisplayName(attributeType);

        const section = document.createElement("div");
        section.className = "mt-4";

        const heading = document.createElement("h4");
        heading.className =
          "text-sm font-medium text-(--content-heading) mb-2";
        heading.textContent = displayName;

        const buttonContainer = document.createElement("div");
        buttonContainer.className = "flex flex-wrap gap-2";

        const span = document.createElement("span");
        span.className =
          "px-2.5 py-1.5 border rounded-sm text-sm cursor-default bg-(--ui-variant-selected-surface) text-(--ui-variant-selected-text) border-(--ui-variant-selected-border)";
        span.setAttribute(
          "aria-label",
          `${displayName}: ${attributeValues[0]}`,
        );
        span.textContent = attributeValues[0];

        buttonContainer.appendChild(span);
        section.appendChild(heading);
        section.appendChild(buttonContainer);
        container.appendChild(section);
      });
    }
  }

  private handleAttributeSelection(
    attributeType: string,
    value: string,
  ): void {
    this.selectedAttributes[attributeType] = value;
    this.updateCurrentVariation();
    this.updateAttributeButtonStates();
  }

  private updateCurrentVariation(): void {
    try {
      const matchingVariation = findVariationByAttributes(
        this.productData.variations,
        this.selectedAttributes,
      );

      if (matchingVariation) {
        this.currentVariation = matchingVariation;
        this.updateProductUI();
      } else {
        // No exact match - find closest variation matching selected color for image
        const selectedColor = this.selectedAttributes.color;
        const colorMatchVariation = selectedColor
          ? this.productData.variations.find(
              (v: any) => v.attributes?.color === selectedColor,
            )
          : null;

        if (colorMatchVariation?.image) {
          this.uiManager.updateProductImage(colorMatchVariation.image);
          this.renderGallery(
            colorMatchVariation.images || [],
            colorMatchVariation.image,
          );
        }

        this.showOutOfStockState();
      }
    } catch (error) {
      const appError = processClientError(error, "updateCurrentVariation");
      logError(appError);
    }
  }

  private showOutOfStockState(): void {
    if (!this.currentVariation) return;

    // Update price
    this.uiManager.updatePriceDisplay(this.currentVariation.price, {
      saleInfo: this.currentVariation.saleInfo,
      unit: this.currentVariation.unit || this.currentProduct?.unit,
    });

    // Get out of stock availability info
    const outOfStockInfo = cart.getProductAvailability(
      this.productData.productId,
      "out-of-stock",
      0,
    );
    this.uiManager.updateQuantityControls(outOfStockInfo);
    this.uiManager.updateAddToCartButton(outOfStockInfo);
    this.uiManager.updateImageOverlay(outOfStockInfo);
    this.uiManager.updateInventoryDisplay(outOfStockInfo);

    // Hide quantity stepper, show back-in-stock form
    this.updateQuantityAndBis(false, 0);

    // Update button product data
    this.uiManager.updateButtonProductData(
      this.buildProductData(this.currentVariation),
    );
  }

  private updateProductUI(): void {
    if (!this.currentVariation || !this.currentProduct) return;

    // Get availability info first
    const availabilityInfo = cart.getProductAvailability(
      this.productData.productId,
      this.currentVariation.variationId,
      this.currentVariation.quantity || 0,
    );

    const isGiftCard = !!this.currentProduct?.isGiftCard;

    // Use centralized updateAvailabilityDisplay for complete UI update
    this.uiManager.updateAvailabilityDisplay(
      availabilityInfo,
      this.currentVariation.saleInfo,
      isGiftCard,
    );

    // Update price separately with unit
    this.uiManager.updatePriceDisplay(this.currentVariation.price, {
      saleInfo: this.currentVariation.saleInfo,
      unit: this.currentVariation.unit || this.currentProduct.unit,
    });

    // Update image and thumbnail gallery from the current variation's image list
    if (this.currentVariation.image) {
      this.uiManager.updateProductImage(this.currentVariation.image);
    }
    this.renderGallery(
      this.currentVariation.images || [],
      this.currentVariation.image || "",
    );

    // Show quantity stepper only when >1 unit available; show BIS when OOS
    const qty = this.currentVariation.quantity || 0;
    const inStock = this.currentVariation.inStock ?? qty > 0;
    this.updateQuantityAndBis(inStock, qty, isGiftCard);

    // Update button product data
    this.uiManager.updateButtonProductData(
      this.buildProductData(this.currentVariation),
    );
  }

  private buildProductData(variation: any): any {
    if (!this.currentProduct) return null;

    const productData = {
      id: this.currentProduct.id,
      catalogObjectId: this.currentProduct.catalogObjectId,
      variationId: variation.variationId,
      title: this.currentProduct.title,
      price: variation.price,
      image: this.currentProduct.image,
      unit: variation.unit || this.currentProduct.unit || "",
      variationName: variation.name || "",
      quantity: 1,
      saleInfo: variation.saleInfo || undefined,
      isGiftCard: this.currentProduct.isGiftCard || undefined,
    };

    if (variation.image) productData.image = variation.image;

    return productData;
  }

  // Show/hide quantity stepper and back-in-stock form based on stock state
  private updateQuantityAndBis(
    inStock: boolean,
    quantity: number,
    isGiftCard = false,
  ): void {
    const quantitySection = document.getElementById(
      "quick-view-quantity-section",
    );
    const bisSection = document.getElementById("qv-bis-section");
    const atcWrapper = document.getElementById("qv-atc-wrapper");

    // Gift cards: always show stepper (capped at 10), never show BIS
    const showQuantity = isGiftCard ? true : inStock && quantity > 1;
    const showBis = isGiftCard ? false : !inStock;

    // Update quantity input max for gift cards
    if (isGiftCard) {
      const qtyInput = document.getElementById(
        "quick-view-quantity",
      ) as HTMLInputElement | null;
      if (qtyInput) qtyInput.max = "10";
    }

    quantitySection?.classList.toggle("hidden", !showQuantity);
    bisSection?.classList.toggle("hidden", !showBis);
    // Hide the disabled "Sold Out" CTA when BIS form is showing — it's
    // non-actionable and competes visually with the primary BIS action
    atcWrapper?.classList.toggle("hidden", showBis);

    if (showBis && this.currentProduct && this.currentVariation) {
      // Update hidden form fields for the current sold-out variant
      const label = this.currentVariation.name
        ? `${this.currentProduct.title} — ${this.currentVariation.name}`
        : this.currentProduct.title;

      (document.getElementById(
        "qv-bis-product-id",
      ) as HTMLInputElement | null) &&
        ((
          document.getElementById("qv-bis-product-id") as HTMLInputElement
        ).value = this.currentProduct.id);
      (document.getElementById(
        "qv-bis-variation-id",
      ) as HTMLInputElement | null) &&
        ((
          document.getElementById("qv-bis-variation-id") as HTMLInputElement
        ).value = this.currentVariation.variationId);
      (document.getElementById(
        "qv-bis-product-title",
      ) as HTMLInputElement | null) &&
        ((
          document.getElementById("qv-bis-product-title") as HTMLInputElement
        ).value = label);
      // Ensure product_url is always a fully-qualified URL so email links work
      const absProductUrl = this.currentProduct.url
        ? new URL(this.currentProduct.url, window.location.origin).href
        : window.location.href;
      (document.getElementById(
        "qv-bis-product-url",
      ) as HTMLInputElement | null) &&
        ((
          document.getElementById("qv-bis-product-url") as HTMLInputElement
        ).value = absProductUrl);

      const labelEl = document.getElementById("qv-bis-label");
      if (labelEl)
        labelEl.textContent = `Enter your email and we'll reach out when ${label} is back in stock.`;

      // Reset form state when switching to a different sold-out variant (or reopening QuickView)
      const form = document.getElementById(
        "qv-bis-form",
      ) as HTMLFormElement | null;
      const emailInput = document.getElementById(
        "qv-bis-email",
      ) as HTMLInputElement | null;
      const submitBtn = document.getElementById(
        "qv-bis-submit",
      ) as HTMLButtonElement | null;
      if (form) form.classList.remove("hidden");
      if (emailInput) emailInput.value = "";
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Notify Me";
      }
      document.getElementById("qv-bis-success")?.classList.add("hidden");
      document.getElementById("qv-bis-error")?.classList.add("hidden");

      // Wire up form submit once
      this.setupBisForm();
    }
  }

  private setupBisForm(): void {
    const form = document.getElementById(
      "qv-bis-form",
    ) as HTMLFormElement | null;
    if (!form || form.dataset.initialized === "true") return;
    form.dataset.initialized = "true";

    const submitBtn = document.getElementById(
      "qv-bis-submit",
    ) as HTMLButtonElement | null;
    const successMsg = document.getElementById("qv-bis-success");
    const errorMsg = document.getElementById("qv-bis-error");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = (
        document.getElementById("qv-bis-email") as HTMLInputElement | null
      )?.value?.trim();
      if (!email || !submitBtn) return;

      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";

      try {
        const res = await fetch("/api/back-in-stock", {
          method: "POST",
          body: new FormData(form),
        });

        if (res.ok) {
          form.classList.add("hidden");
          successMsg?.classList.remove("hidden");
          errorMsg?.classList.add("hidden");
        } else {
          throw new Error("Non-OK response");
        }
      } catch {
        errorMsg?.classList.remove("hidden");
        submitBtn.disabled = false;
        submitBtn.textContent = "Notify Me";
      }
    });
  }

  private updateAttributeButtonStates(): void {
    if (!this.productData?.variations) return;

    // EXACTLY mirror PDP updateAttributeButtonStates pattern
    Object.keys(this.productData.availableAttributes).forEach(
      (attributeType) => {
        const buttons = document.querySelectorAll(
          `[data-attribute-type="${attributeType}"]`,
        );

        buttons.forEach((btn) => {
          const button = btn as HTMLButtonElement;
          const value = button.dataset.attributeValue;
          if (!value) return;

          const isSelected = this.selectedAttributes[attributeType] === value;

          // Test availability using PDP pattern
          const isAvailable = this.canAddToCartForAttribute(
            attributeType,
            value,
          );

          // Update selected state styling (PDP pattern)
          if (isSelected) {
            button.className =
              "px-2.5 py-1.5 border rounded-sm text-sm cursor-pointer bg-(--ui-variant-selected-surface) text-(--ui-variant-selected-text) border-(--ui-variant-selected-border)";
          } else {
            button.className =
              "px-2.5 py-1.5 border rounded-sm text-sm cursor-pointer bg-(--ui-input-surface) text-(--ui-input-text) border-(--ui-input-border)/50";
          }

          // Apply opacity for availability (but keep clickable)
          if (!isAvailable) {
            button.classList.add("opacity-60");
            button.classList.add("line-through");
          } else {
            button.classList.remove("opacity-60");
            button.classList.remove("line-through");
          }
        });
      },
    );
  }

  private canAddToCartForAttribute(
    attributeType: string,
    value: string,
  ): boolean {
    // EXACTLY mirror PDP canAddToCartFn pattern
    const testAttributes = {
      ...this.selectedAttributes,
      [attributeType]: value,
    };

    const matchingVariation = findVariationByAttributes(
      this.productData.variations,
      testAttributes,
    );

    return Boolean(
      matchingVariation?.inStock &&
      cart.canAddToCart(
        this.productData.productId,
        matchingVariation.variationId,
        matchingVariation.quantity || 0,
      ),
    );
  }

  private updateViewDetailsButton(product: Product): void {
    const button = document.getElementById(
      "quick-view-full-details",
    ) as HTMLButtonElement;
    if (button && product) {
      button.onclick = () => {
        // Capture variant BEFORE closeModal() — resetState() nulls
        // this.currentVariation synchronously, so reading it afterward
        // always returns undefined and the slug is lost.
        const baseUrl = product.url.split("?")[0];
        const variationName = this.currentVariation?.name;
        const variantSlug = variationName
          ? variationName
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, "")
              .replace(/\s+/g, "-")
              .replace(/-+/g, "-")
              .replace(/^-|-$/g, "")
          : null;
        const url = variantSlug
          ? `${baseUrl}?variant=${variantSlug}`
          : baseUrl;

        this.closeModal();
        // Use Astro's navigate() so the view-transition router handles the
        // navigation — this uses any prefetched content and plays the page
        // transition animation instead of a jarring hard reload.
        navigate(url);
      };
    }
  }

  async addToCart(): Promise<void> {
    if (!this.currentProduct || !this.currentVariation || this.isProcessing)
      return;

    this.isProcessing = true;
    const addToCartBtn = document.getElementById(
      "quick-view-add-to-cart",
    ) as HTMLButtonElement;
    const addToCartText = addToCartBtn?.querySelector(".add-to-cart-text");
    const addToCartLoading = addToCartBtn?.querySelector(
      ".add-to-cart-loading",
    );

    try {
      if (addToCartBtn) addToCartBtn.disabled = true;
      addToCartText?.classList.add("hidden");
      addToCartLoading?.classList.remove("hidden");

      // Get quantity from input (not hardcoded) - use fresh element reference
      const quantityInput = document.getElementById(
        "quick-view-quantity",
      ) as HTMLInputElement;
      const quantity = quantityInput ? parseInt(quantityInput.value, 10) : 1;

      // Validate quantity is valid number
      if (isNaN(quantity) || quantity < 1) {
        throw new Error("Please enter a valid quantity");
      }

      // Validate availability before adding (PDP pattern)
      if (
        !cart.canAddToCart(
          this.currentProduct.id,
          this.currentVariation.variationId,
          this.currentVariation.quantity || 0,
          quantity,
        )
      ) {
        throw new Error("Cannot add that quantity to cart");
      }

      // Get current button data (updated by updateButtonProductData)
      const buttonData = addToCartBtn.dataset.product;
      if (!buttonData) throw new Error("No product data found");

      const cartItem = JSON.parse(buttonData);
      cartItem.quantity = quantity; // Use actual quantity from input

      const result = await cart.addItem(cartItem);

      if (result.success) {
        showNotification(
          result.message || "Added to cart",
          "success",
          3000,
          { label: "View Cart", href: "/cart" },
        );

        // Update UI after cart addition (PDP pattern)
        this.handleCartUpdate();

        // Close QuickView modal
        this.closeModal();

        // Open MiniCart to show the item was added (desktop only)
        if (window.innerWidth >= 1024) {
          window.dispatchEvent(new CustomEvent("openMiniCart"));
        }
      } else {
        throw new Error(result.message || "Failed to add to cart");
      }
    } catch (error) {
      const appError = processClientError(error, "quickViewAddToCart");
      logError(appError);

      showNotification(appError.message, "error");
    } finally {
      this.isProcessing = false;
      if (addToCartBtn) addToCartBtn.disabled = false;
      addToCartText?.classList.remove("hidden");
      addToCartLoading?.classList.add("hidden");
    }
  }

  private handleCartUpdate(): void {
    // Use centralized UI manager for cart updates
    if (!this.currentVariation || !this.currentProduct) return;

    const availabilityInfo = cart.getProductAvailability(
      this.productData.productId,
      this.currentVariation.variationId,
      this.currentVariation.quantity || 0,
    );

    // updateAvailabilityDisplay covers all four sub-updates:
    //   updateQuantityControls + updateAddToCartButton +
    //   updateImageOverlay + updateInventoryDisplay (the "N in cart" text)
    this.uiManager.updateAvailabilityDisplay(
      availabilityInfo,
      this.currentVariation.saleInfo,
    );
    this.updateAttributeButtonStates();
  }

  private showLoading(): void {
    this.hideAllStates();
    document.getElementById("quick-view-loading")?.classList.remove("hidden");
  }

  private showError(): void {
    this.hideAllStates();
    document.getElementById("quick-view-error")?.classList.remove("hidden");
  }

  private showProduct(): void {
    this.hideAllStates();
    document.getElementById("quick-view-product")?.classList.remove("hidden");
    document.getElementById("quick-view-footer")?.classList.remove("hidden");
  }

  private hideAllStates(): void {
    ["quick-view-loading", "quick-view-error", "quick-view-product"].forEach(
      (id) => {
        document.getElementById(id)?.classList.add("hidden");
      },
    );
    document.getElementById("quick-view-footer")?.classList.add("hidden");
  }

  private openModal(): void {
    const overlay = document.getElementById("quick-view-overlay");
    const panel = document.getElementById("quick-view-panel");

    if (overlay && panel) {
      overlay.classList.remove("hidden");
      document.body.style.overflow = "hidden";
      panel.removeAttribute("inert");

      requestAnimationFrame(() => {
        overlay.classList.remove("opacity-0");
        panel.classList.remove("-translate-x-full");
      });
    }
  }

  closeModal(): void {
    const overlay = document.getElementById("quick-view-overlay");
    const panel = document.getElementById("quick-view-panel");

    if (overlay && panel) {
      panel.setAttribute("inert", "");
      overlay.classList.add("opacity-0");
      panel.classList.add("-translate-x-full");
      document.body.style.overflow = "unset";

      setTimeout(() => overlay.classList.add("hidden"), 300);
    }

    this.resetState();
  }

  private resetState(): void {
    this.currentProduct = null;
    this.lastProductId = null;
    this.currentVariation = null;
    this.selectedAttributes = {};
    this.productData = null;
    this.isProcessing = false;
  }

  private setupQuantityControls(): void {
    // EXACTLY mirror PDP quantity control setup
    const quantityInput = document.getElementById(
      "quick-view-quantity",
    ) as HTMLInputElement;
    const decreaseBtn = document.getElementById(
      "quick-view-decrease",
    ) as HTMLButtonElement;
    const increaseBtn = document.getElementById(
      "quick-view-increase",
    ) as HTMLButtonElement;

    if (!quantityInput || !decreaseBtn || !increaseBtn) return;

    // CRITICAL FIX: Remove existing event listeners to prevent duplicates
    const newDecreaseBtn = decreaseBtn.cloneNode(true) as HTMLButtonElement;
    const newIncreaseBtn = increaseBtn.cloneNode(true) as HTMLButtonElement;
    const newQuantityInput = quantityInput.cloneNode(
      true,
    ) as HTMLInputElement;

    decreaseBtn.parentNode?.replaceChild(newDecreaseBtn, decreaseBtn);
    increaseBtn.parentNode?.replaceChild(newIncreaseBtn, increaseBtn);
    quantityInput.parentNode?.replaceChild(newQuantityInput, quantityInput);

    // PDP quantity control patterns with fresh elements
    newIncreaseBtn.addEventListener("click", () => {
      const currentValue = parseInt(newQuantityInput.value, 10) || 0;
      const maxValue = parseInt(newQuantityInput.max, 10) || 0;

      if (currentValue < maxValue) {
        newQuantityInput.value = String(currentValue + 1);
        this.updateQuantityButtonStates();
      }
    });

    newDecreaseBtn.addEventListener("click", () => {
      const currentValue = parseInt(newQuantityInput.value, 10) || 0;
      if (currentValue > 1) {
        newQuantityInput.value = String(currentValue - 1);
        this.updateQuantityButtonStates();
      }
    });

    newQuantityInput.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      let value = parseInt(target.value, 10);
      const max = parseInt(target.max, 10) || 1;

      if (isNaN(value) || value < 1) value = 1;
      else if (value > max) value = max;

      target.value = String(value);
      this.updateQuantityButtonStates();
    });
  }

  private updateQuantityButtonStates(): void {
    // EXACTLY mirror PDP quantity button state updates - use fresh element references
    const quantityInput = document.getElementById(
      "quick-view-quantity",
    ) as HTMLInputElement;
    const decreaseBtn = document.getElementById(
      "quick-view-decrease",
    ) as HTMLButtonElement;
    const increaseBtn = document.getElementById(
      "quick-view-increase",
    ) as HTMLButtonElement;

    if (!quantityInput) return;

    const value = parseInt(quantityInput.value, 10);
    const max = parseInt(quantityInput.max, 10) || 0;

    if (decreaseBtn) decreaseBtn.disabled = value <= 1;
    if (increaseBtn) increaseBtn.disabled = value >= max;
  }

  setupEventHandlers(): void {
    // Close button
    const closeButton = document.getElementById("close-quick-view");
    closeButton?.addEventListener("click", () => this.closeModal());

    // Overlay click
    const overlay = document.getElementById("quick-view-overlay");
    overlay?.addEventListener("click", (e) => {
      if (e.target === overlay) this.closeModal();
    });

    // Add to cart
    const addToCartBtn = document.getElementById("quick-view-add-to-cart");
    addToCartBtn?.addEventListener("click", () => this.addToCart());

    // Retry button
    const retryBtn = document.getElementById("quick-view-retry");
    retryBtn?.addEventListener("click", () => {
      const id = this.currentProduct?.id ?? this.lastProductId;
      if (id) {
        this.openQuickView(id);
      }
    });

    // Quantity controls
    this.setupQuantityControls();

    // Global click handler for quick view triggers
    document.addEventListener(
      "click",
      (e) => {
        const trigger = (e.target as Element)?.closest(
          ".quick-view-trigger",
        ) as HTMLElement;
        if (trigger) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          const productId = trigger.dataset.productId;
          const variationId = trigger.dataset.variationId || undefined;
          if (productId) {
            this.openQuickView(productId, variationId);
          }
          return false;
        }
      },
      true,
    );

    // Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const panel = document.getElementById("quick-view-panel");
        if (panel && !panel.classList.contains("-translate-x-full")) {
          this.closeModal();
        }
      }
    });

    // Thumbnail gallery — event delegation so it survives innerHTML rebuilds
    const thumbnailContainer = document.getElementById(
      "quick-view-thumbnails",
    );
    thumbnailContainer?.addEventListener("click", (e) => {
      const thumb = (e.target as Element).closest<HTMLButtonElement>(
        ".quick-view-thumb",
      );
      if (!thumb) return;

      const src = thumb.dataset.gallerySrc;
      if (!src) return;

      // Update active thumb styles
      thumbnailContainer
        .querySelectorAll<HTMLButtonElement>(".quick-view-thumb")
        .forEach((t) => {
          t.classList.remove("border-(--ui-button-border)", "opacity-100");
          t.classList.add("border-(--border-secondary)", "opacity-60");
          t.setAttribute("aria-pressed", "false");
        });
      thumb.classList.add("border-(--ui-button-border)", "opacity-100");
      thumb.classList.remove("border-(--border-secondary)", "opacity-60");
      thumb.setAttribute("aria-pressed", "true");

      // Crossfade the main image
      const mainImage = document.getElementById(
        "quick-view-image",
      ) as HTMLImageElement | null;
      if (mainImage) {
        mainImage.style.opacity = "0";
        mainImage.src = this.optimizeImageSrc(src, 400);
        if (mainImage.complete && mainImage.naturalWidth > 0) {
          mainImage.style.opacity = "0.9";
        } else {
          mainImage.onload = () => {
            mainImage.style.opacity = "0.9";
          };
          mainImage.onerror = () => {
            mainImage.style.opacity = "1";
          };
        }
      }
    });

    // Cart update events (PDP pattern)
    window.addEventListener("cartUpdated", () => {
      if (this.currentVariation && this.currentProduct) {
        this.handleCartUpdate();
      }
    });
  }
}
