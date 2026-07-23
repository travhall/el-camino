/**
 * Characterization tests for QuickViewController — extracted from
 * QuickView.astro's <script> block (plan 053). Goal is coverage of the
 * singleton pattern and a couple of key public methods, not exhaustive
 * behavior testing (mirrors pdpController-real.test.ts's approach).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/cart", () => ({
  cart: {
    getProductAvailability: vi.fn(() => ({
      state: "AVAILABLE",
      total: 10,
      inCart: 0,
      remaining: 10,
      canAdd: true,
    })),
    canAddToCart: vi.fn(() => true),
    addItem: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

vi.mock("@/lib/product/pdpUI", () => ({
  PDPUIManager: class {
    updateAvailabilityDisplay = vi.fn();
    updatePriceDisplay = vi.fn();
    updateProductImage = vi.fn();
    updateButtonProductData = vi.fn();
    updateAttributeButtonStates = vi.fn();
  },
}));

vi.mock("@/lib/square/errorUtils", () => ({
  processClientError: vi.fn((error) => ({ message: String(error) })),
  logError: vi.fn(),
}));

vi.mock("@/lib/events", () => ({
  showNotification: vi.fn(),
}));

vi.mock("astro:transitions/client", () => ({
  navigate: vi.fn(),
}));

import { QuickViewController } from "../quickViewController";

function setupDom(): void {
  document.body.innerHTML = `
    <div id="quick-view-overlay" class="hidden opacity-0"></div>
    <div id="quick-view-panel" class="-translate-x-full"></div>
    <div id="quick-view-loading" class="hidden"></div>
    <div id="quick-view-error" class="hidden"></div>
    <div id="quick-view-product" class="hidden"></div>
    <div id="quick-view-footer" class="hidden"></div>
    <img id="quick-view-image" />
    <div id="quick-view-image-placeholder"></div>
    <p id="quick-view-brand" class="hidden"></p>
    <h3 id="quick-view-title-text"></h3>
    <p id="quick-view-description" class="hidden"></p>
    <div id="quick-view-attributes"></div>
    <div id="quick-view-thumbnails" class="hidden"></div>
  `;
}

const product = {
  id: "prod-1",
  catalogObjectId: "prod-1",
  variationId: "var-1",
  title: "Test Deck",
  image: "test.jpg",
  price: 65,
  url: "/product/test-deck",
  variations: [
    {
      id: "var-1",
      variationId: "var-1",
      name: "Test Deck",
      price: 65,
      quantity: 10,
      inStock: true,
      attributes: {},
    },
  ],
};

describe("QuickViewController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDom();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve(product),
      }),
    ) as unknown as typeof fetch;
  });

  it("getInstance() returns the same instance on repeated calls", () => {
    const a = QuickViewController.getInstance();
    const b = QuickViewController.getInstance();
    expect(a).toBe(b);
  });

  it("openQuickView() fetches the product and reveals the product panel", async () => {
    const controller = QuickViewController.getInstance();
    await controller.openQuickView("prod-1");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/quick-view-product?id=prod-1"),
      expect.any(Object),
    );
    expect(
      document.getElementById("quick-view-product")?.classList.contains("hidden"),
    ).toBe(false);
    expect(document.getElementById("quick-view-title-text")?.textContent).toBe(
      "Test Deck",
    );
  });

  it("openQuickView() shows the error state when the fetch fails", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("network error"))) as unknown as typeof fetch;
    const controller = QuickViewController.getInstance();
    await controller.openQuickView("prod-1");

    expect(
      document.getElementById("quick-view-error")?.classList.contains("hidden"),
    ).toBe(false);
  });

  it("closeModal() hides the overlay and resets panel state", async () => {
    const controller = QuickViewController.getInstance();
    await controller.openQuickView("prod-1");

    controller.closeModal();

    expect(document.getElementById("quick-view-panel")?.getAttribute("inert")).toBe("");
    expect(
      document.getElementById("quick-view-overlay")?.classList.contains("opacity-0"),
    ).toBe(true);
    expect(document.body.style.overflow).toBe("unset");
  });
});
