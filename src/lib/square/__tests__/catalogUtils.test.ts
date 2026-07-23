import { describe, it, expect } from "vitest";
import { extractSaleInfo, extractBrandValue, extractIsGiftCard } from "../catalogUtils";
import type { SquareCatalogCustomAttributeValue } from "../types";

const attr = (
  name: string,
  overrides: Partial<SquareCatalogCustomAttributeValue> = {},
): SquareCatalogCustomAttributeValue => ({
  name,
  type: "STRING",
  ...overrides,
});

describe("extractSaleInfo", () => {
  it("returns null when there is no custom attribute data", () => {
    expect(extractSaleInfo(undefined, 50)).toBeNull();
    expect(extractSaleInfo(null, 50)).toBeNull();
  });

  it("returns null when no sale_price attribute is present", () => {
    const attrs = { a: attr("Brand", { stringValue: "Baker" }) };
    expect(extractSaleInfo(attrs, 50)).toBeNull();
  });

  it("computes salePrice, originalPrice, and discountPercent from a valid sale attribute", () => {
    const attrs = {
      a: attr("Sale Price", { type: "NUMBER", numberValue: "40" }),
    };
    const result = extractSaleInfo(attrs, 50);
    expect(result).toEqual({
      salePrice: 40,
      originalPrice: 50,
      discountPercent: 20,
      saleEndDate: undefined,
    });
  });

  it("includes saleEndDate when a valid sale_end_date attribute is present", () => {
    const attrs = {
      a: attr("Sale Price", { type: "NUMBER", numberValue: "40" }),
      b: attr("Sale End Date", { type: "STRING", stringValue: "2026-12-31" }),
    };
    const result = extractSaleInfo(attrs, 50);
    expect(result?.saleEndDate).toBe("2026-12-31");
  });

  it("rejects a sale price that is not lower than the regular price", () => {
    const attrs = {
      a: attr("Sale Price", { type: "NUMBER", numberValue: "60" }),
    };
    expect(extractSaleInfo(attrs, 50)).toBeNull();
  });

  it("rejects a sale price of zero or negative", () => {
    const attrs = {
      a: attr("Sale Price", { type: "NUMBER", numberValue: "0" }),
    };
    expect(extractSaleInfo(attrs, 50)).toBeNull();
  });

  it("matches by key as a fallback when name doesn't match", () => {
    const attrs = {
      a: attr("", { key: "sale_price", type: "NUMBER", numberValue: "40" }),
    };
    const result = extractSaleInfo(attrs, 50);
    expect(result?.salePrice).toBe(40);
  });
});

describe("extractBrandValue", () => {
  it("extracts the brand string value", () => {
    const attrs = { a: attr("Brand", { stringValue: "Baker" }) };
    expect(extractBrandValue(attrs)).toBe("Baker");
  });

  it("returns an empty string when no brand attribute is present", () => {
    expect(extractBrandValue({})).toBe("");
  });

  it("returns an empty string when customAttributeValues is null/undefined", () => {
    expect(extractBrandValue(undefined)).toBe("");
    expect(extractBrandValue(null)).toBe("");
  });

  it("matches by key as a fallback when name doesn't match", () => {
    const attrs = { a: attr("", { key: "brand", type: "STRING", stringValue: "Anti-Hero" }) };
    expect(extractBrandValue(attrs)).toBe("Anti-Hero");
  });
});

describe("extractIsGiftCard", () => {
  it("returns true for a BOOLEAN attribute set to true", () => {
    const attrs = { a: attr("isGiftCard", { type: "BOOLEAN", booleanValue: true }) };
    expect(extractIsGiftCard(attrs)).toBe(true);
  });

  it("returns false for a BOOLEAN attribute set to false", () => {
    const attrs = { a: attr("isGiftCard", { type: "BOOLEAN", booleanValue: false }) };
    expect(extractIsGiftCard(attrs)).toBe(false);
  });

  it("returns true for STRING attribute values 'true', 'yes', or '1'", () => {
    for (const value of ["true", "yes", "1", "TRUE"]) {
      const attrs = { a: attr("isGiftCard", { type: "STRING", stringValue: value }) };
      expect(extractIsGiftCard(attrs)).toBe(true);
    }
  });

  it("returns false for other STRING attribute values", () => {
    const attrs = { a: attr("isGiftCard", { type: "STRING", stringValue: "no" }) };
    expect(extractIsGiftCard(attrs)).toBe(false);
  });

  it("returns false when no isGiftCard attribute is present", () => {
    expect(extractIsGiftCard({})).toBe(false);
  });

  it("returns false when customAttributeValues is null/undefined", () => {
    expect(extractIsGiftCard(undefined)).toBe(false);
    expect(extractIsGiftCard(null)).toBe(false);
  });
});
