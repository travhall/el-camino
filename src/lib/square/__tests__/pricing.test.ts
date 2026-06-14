/**
 * Pricing module tests
 *
 * Focus: getAuthoritativePricing must derive prices ONLY from the Square
 * catalog and fail safe (no trusted entry) on bad input or API errors, so the
 * checkout never honors a client-supplied discount.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockBatchGet, mockExtractSaleInfo, mockLogApiError } = vi.hoisted(() => ({
  mockBatchGet: vi.fn(),
  mockExtractSaleInfo: vi.fn(),
  mockLogApiError: vi.fn(),
}));

vi.mock("../client", () => ({
  squareClient: {
    catalog: { batchGet: mockBatchGet },
  },
  // Deterministic stub: a sale exists only when the attrs carry an explicit
  // `__sale` dollar amount. Lets us assert pricing.ts wires it through faithfully.
  extractSaleInfo: mockExtractSaleInfo,
}));

vi.mock("../apiUtils", () => ({
  logApiError: mockLogApiError,
}));

import { getAuthoritativePricing } from "../pricing";

const variation = (id: string, cents: number, attrs: any = undefined) => ({
  id,
  type: "ITEM_VARIATION",
  itemVariationData: { priceMoney: { amount: BigInt(cents), currency: "USD" } },
  customAttributeValues: attrs,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockExtractSaleInfo.mockImplementation((attrs: any) =>
    attrs?.__sale ? { salePrice: attrs.__sale } : null
  );
});

describe("getAuthoritativePricing", () => {
  it("returns regular price from the catalog with no sale", async () => {
    mockBatchGet.mockResolvedValue({ objects: [variation("v1", 5000)] });

    const result = await getAuthoritativePricing(["v1"]);

    expect(result.v1).toEqual({
      regularPrice: 50,
      salePrice: undefined,
      effectivePrice: 50,
    });
    expect(mockBatchGet).toHaveBeenCalledWith({ objectIds: ["v1"] });
  });

  it("derives the sale price from catalog custom attributes", async () => {
    mockBatchGet.mockResolvedValue({
      objects: [variation("v1", 5000, { __sale: 30 })],
    });

    const result = await getAuthoritativePricing(["v1"]);

    expect(result.v1).toEqual({
      regularPrice: 50,
      salePrice: 30,
      effectivePrice: 30,
    });
  });

  it("dedupes IDs and ignores non-variation objects", async () => {
    mockBatchGet.mockResolvedValue({
      objects: [variation("v1", 1000), { id: "img1", type: "IMAGE" }],
    });

    const result = await getAuthoritativePricing(["v1", "v1"]);

    expect(mockBatchGet).toHaveBeenCalledWith({ objectIds: ["v1"] });
    expect(Object.keys(result)).toEqual(["v1"]);
  });

  it("omits variable-price variations that have no fixed amount", async () => {
    mockBatchGet.mockResolvedValue({
      objects: [{ id: "gc", type: "ITEM_VARIATION", itemVariationData: {} }],
    });

    const result = await getAuthoritativePricing(["gc"]);

    expect(result.gc).toBeUndefined();
  });

  it("returns an empty map (fail safe) when the API throws", async () => {
    mockBatchGet.mockRejectedValue(new Error("Square down"));

    const result = await getAuthoritativePricing(["v1"]);

    expect(result).toEqual({});
    expect(mockLogApiError).toHaveBeenCalledWith(
      "getAuthoritativePricing",
      expect.any(Error)
    );
  });

  it("short-circuits without an API call for empty input", async () => {
    const result = await getAuthoritativePricing([]);

    expect(result).toEqual({});
    expect(mockBatchGet).not.toHaveBeenCalled();
  });
});
