import { describe, it, expect, vi } from "vitest";

const mockFetchCategoryHierarchy = vi.fn();
vi.mock("../categories", () => ({
  fetchCategoryHierarchy: () => mockFetchCategoryHierarchy(),
}));

import {
  parseFiltersFromURL,
  filtersToURLParams,
  getActiveFiltersCount,
  hasActiveFilters,
  clearAllFilters,
  filterSaleProducts,
  extractFilterOptions,
} from "../filterUtils";
import type { Product, ProductFilters } from "../types";

describe("parseFiltersFromURL", () => {
  it("parses brands, categories, availability, and onSale from search params", () => {
    const params = new URLSearchParams(
      "brands=Baker&brands=Krooked&categories=cat-1&availability=true&onSale=true",
    );
    expect(parseFiltersFromURL(params)).toEqual({
      brands: ["Baker", "Krooked"],
      categories: ["cat-1"],
      availability: true,
      onSale: true,
    });
  });

  it("defaults to empty arrays and false flags when no params are present", () => {
    expect(parseFiltersFromURL(new URLSearchParams())).toEqual({
      brands: [],
      categories: [],
      availability: false,
      onSale: false,
    });
  });

  it("filters out empty-string values from multi-value params", () => {
    const params = new URLSearchParams();
    params.append("brands", "Baker");
    params.append("brands", "");
    expect(parseFiltersFromURL(params).brands).toEqual(["Baker"]);
  });
});

describe("filtersToURLParams", () => {
  it("round-trips through parseFiltersFromURL", () => {
    const filters: ProductFilters = {
      brands: ["Baker", "Krooked"],
      categories: ["cat-1"],
      availability: true,
      onSale: false,
    };
    const params = filtersToURLParams(filters);
    expect(parseFiltersFromURL(params)).toEqual(filters);
  });

  it("omits keys for empty/false filter values", () => {
    const params = filtersToURLParams(clearAllFilters());
    expect(params.toString()).toBe("");
  });
});

describe("getActiveFiltersCount", () => {
  it("sums brand + category counts plus one for each active boolean flag", () => {
    const filters: ProductFilters = {
      brands: ["Baker"],
      categories: ["cat-1", "cat-2"],
      availability: true,
      onSale: true,
    };
    expect(getActiveFiltersCount(filters)).toBe(5);
  });

  it("returns 0 for cleared filters", () => {
    expect(getActiveFiltersCount(clearAllFilters())).toBe(0);
  });
});

describe("hasActiveFilters", () => {
  it("returns false for cleared filters", () => {
    expect(hasActiveFilters(clearAllFilters())).toBe(false);
  });

  it("returns true when any single filter is active", () => {
    expect(hasActiveFilters({ brands: ["Baker"], categories: [], availability: false, onSale: false })).toBe(true);
    expect(hasActiveFilters({ brands: [], categories: [], availability: true, onSale: false })).toBe(true);
    expect(hasActiveFilters({ brands: [], categories: [], availability: false, onSale: true })).toBe(true);
  });
});

describe("clearAllFilters", () => {
  it("returns a filters object with everything empty/false", () => {
    expect(clearAllFilters()).toEqual({
      brands: [],
      categories: [],
      availability: false,
      onSale: false,
    });
  });
});

describe("filterSaleProducts", () => {
  const variation = (saleInfo?: unknown) => ({ saleInfo }) as any;

  it("keeps products where any variation has saleInfo", () => {
    const products = [
      { id: "1", variations: [variation(undefined), variation({ salePrice: 10 })] },
      { id: "2", variations: [variation(undefined)] },
    ] as Product[];
    expect(filterSaleProducts(products).map((p) => p.id)).toEqual(["1"]);
  });

  it("returns an empty array when no products have a sale variation", () => {
    const products = [{ id: "1", variations: [variation(undefined)] }] as Product[];
    expect(filterSaleProducts(products)).toEqual([]);
  });
});

describe("extractFilterOptions", () => {
  it("counts brands and sorts by popularity", async () => {
    mockFetchCategoryHierarchy.mockResolvedValue([]);
    const products = [
      { brand: "Baker" },
      { brand: "Baker" },
      { brand: "Krooked" },
    ] as Product[];

    const { brands } = await extractFilterOptions(products);
    expect(brands.map((b) => b.name)).toEqual(["Baker", "Krooked"]);
    expect(brands[0].count).toBe(2);
    expect(brands[1].count).toBe(1);
  });

  it("ignores products with no brand", async () => {
    mockFetchCategoryHierarchy.mockResolvedValue([]);
    const { brands } = await extractFilterOptions([{ brand: undefined } as Product]);
    expect(brands).toEqual([]);
  });

  it("degrades gracefully to brand-only options when category hierarchy fetch fails", async () => {
    mockFetchCategoryHierarchy.mockRejectedValue(new Error("Square unavailable"));
    const { brands, categories } = await extractFilterOptions([
      { brand: "Baker" } as Product,
    ]);
    expect(brands).toHaveLength(1);
    expect(categories).toEqual([]);
  });

  it("builds category options counting only products actually in that category or its subcategories", async () => {
    mockFetchCategoryHierarchy.mockResolvedValue([
      {
        category: { id: "parent", name: "Skateboards", slug: "skateboards" },
        subcategories: [{ id: "child", name: "Decks", slug: "decks" }],
      },
    ]);
    const products = [
      { id: "p1", categories: ["parent"] },
      { id: "p2", categories: ["child"] },
      { id: "p3", categories: ["unrelated"] },
    ] as Product[];

    const { categories } = await extractFilterOptions(products);
    expect(categories).toHaveLength(1);
    expect(categories[0].count).toBe(2);
    expect(categories[0].subcategories[0].count).toBe(1);
  });
});
