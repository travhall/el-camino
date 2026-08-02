/**
 * categories.ts unit tests
 *
 * Strategy: mock squareClient, blobCache, and utility helpers so every branch
 * is exercised with controlled inputs. The cache's getOrCompute immediately
 * invokes the compute callback so we can inspect the real mapping logic.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Hoist mock fn declarations ─────────────────────────────────────────────
const {
  mockCatalogList,
  mockCategoryGetOrCompute,
  mockProductClear,
  mockCategoryClear,
  mockProcessSquareError,
  mockHandleError,
  mockFetchProducts,
} = vi.hoisted(() => ({
  mockCatalogList: vi.fn(),
  mockCategoryGetOrCompute: vi.fn(),
  mockProductClear: vi.fn(),
  mockCategoryClear: vi.fn(),
  mockProcessSquareError: vi.fn(),
  mockHandleError: vi.fn(),
  mockFetchProducts: vi.fn(),
}));

vi.mock("../client", () => ({
  squareClient: {
    catalog: {
      list: mockCatalogList,
    },
  },
  fetchProducts: mockFetchProducts,
}));

vi.mock("@/lib/cache/blobCache", () => ({
  categoryCache: {
    getOrCompute: mockCategoryGetOrCompute,
    clear: mockCategoryClear,
  },
  productCache: {
    getOrCompute: vi.fn(),
    clear: mockProductClear,
  },
}));

vi.mock("../serverErrorUtils", () => ({
  processSquareError: mockProcessSquareError,
}));

vi.mock("../errorUtils", () => ({
  handleError: mockHandleError,
}));

// ── Import after mocks ─────────────────────────────────────────────────────
import {
  fetchCategories,
  fetchCategoryHierarchy,
  fetchProductsByCategory,
  clearCategoryCache,
} from "../categories";

// Helper: make getOrCompute pass through to the compute fn
function passthroughGetOrCompute(mockFn: ReturnType<typeof vi.fn>) {
  mockFn.mockImplementation(
    (_key: string, computeFn: () => unknown) => computeFn()
  );
}

describe("fetchCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passthroughGetOrCompute(mockCategoryGetOrCompute);
  });

  it("returns empty array when catalog has no items", async () => {
    mockCatalogList.mockResolvedValue({ data: [] });
    const result = await fetchCategories();
    expect(result).toEqual([]);
  });

  it("returns empty array when data is undefined", async () => {
    mockCatalogList.mockResolvedValue({ data: undefined });
    const result = await fetchCategories();
    expect(result).toEqual([]);
  });

  it("maps a top-level CATEGORY object to the expected shape", async () => {
    mockCatalogList.mockResolvedValue({
      data: [
        {
          type: "CATEGORY",
          id: "cat-1",
          categoryData: {
            name: "Skateboards",
            isTopLevel: true,
            parentCategory: { ordinal: BigInt(1) },
          },
        },
      ],
    });

    const result = await fetchCategories();
    expect(result).toHaveLength(1);
    const cat = result[0];
    expect(cat.id).toBe("cat-1");
    expect(cat.name).toBe("Skateboards");
    expect(cat.slug).toBe("skateboards");
    expect(cat.isTopLevel).toBe(true);
    expect(cat.rawOrder).toBe(1);
  });

  it("filters out non-CATEGORY items from the catalog response", async () => {
    mockCatalogList.mockResolvedValue({
      data: [
        {
          type: "ITEM",
          id: "item-1",
          itemData: { name: "A Skateboard" },
        },
        {
          type: "CATEGORY",
          id: "cat-1",
          categoryData: { name: "Decks", isTopLevel: true },
        },
      ],
    });

    const result = await fetchCategories();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("cat-1");
  });

  it("handles a category with no name gracefully (empty string name and slug)", async () => {
    mockCatalogList.mockResolvedValue({
      data: [
        {
          type: "CATEGORY",
          id: "cat-no-name",
          categoryData: {},
        },
      ],
    });

    const result = await fetchCategories();
    expect(result[0].name).toBe("");
    expect(result[0].slug).toBe("");
  });

  it("uses parentCategoryId as rootCategoryId fallback for non-top-level categories", async () => {
    mockCatalogList.mockResolvedValue({
      data: [
        {
          type: "CATEGORY",
          id: "sub-1",
          categoryData: {
            name: "Complete Skates",
            isTopLevel: false,
            parentCategory: { id: "parent-1", ordinal: BigInt(2) },
          },
        },
      ],
    });

    const result = await fetchCategories();
    expect(result[0].rootCategoryId).toBe("parent-1");
    expect(result[0].parentCategoryId).toBe("parent-1");
  });

  it("uses rootCategory field when present", async () => {
    mockCatalogList.mockResolvedValue({
      data: [
        {
          type: "CATEGORY",
          id: "sub-2",
          categoryData: {
            name: "Wheels",
            isTopLevel: false,
            rootCategory: "root-1",
            parentCategory: { id: "mid-1", ordinal: BigInt(3) },
          },
        },
      ],
    });

    const result = await fetchCategories();
    expect(result[0].rootCategoryId).toBe("root-1");
  });

  it("defaults rawOrder to 999 when no ordinal is present", async () => {
    mockCatalogList.mockResolvedValue({
      data: [
        {
          type: "CATEGORY",
          id: "cat-noorder",
          categoryData: { name: "No Order", isTopLevel: true },
        },
      ],
    });

    const result = await fetchCategories();
    expect(result[0].rawOrder).toBe(999);
  });

  it("returns empty array and calls handleError on Square API failure", async () => {
    const err = new Error("Square unavailable");
    mockCatalogList.mockRejectedValue(err);
    mockProcessSquareError.mockReturnValue({ message: "Square unavailable" });
    mockHandleError.mockReturnValue([]);

    const result = await fetchCategories();
    expect(mockProcessSquareError).toHaveBeenCalledWith(err, "fetchCategories");
    expect(mockHandleError).toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});

describe("fetchCategoryHierarchy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // passthrough for both the inner fetchCategories call and the hierarchy call
    passthroughGetOrCompute(mockCategoryGetOrCompute);
  });

  it("returns empty array when there are no categories", async () => {
    mockCatalogList.mockResolvedValue({ data: [] });
    const result = await fetchCategoryHierarchy();
    expect(result).toEqual([]);
  });

  it("builds hierarchy with subcategories under the correct top-level category", async () => {
    mockCatalogList.mockResolvedValue({
      data: [
        {
          type: "CATEGORY",
          id: "top-1",
          categoryData: {
            name: "Skateboards",
            isTopLevel: true,
            parentCategory: { ordinal: BigInt(1) },
          },
        },
        {
          type: "CATEGORY",
          id: "sub-1",
          categoryData: {
            name: "Decks",
            isTopLevel: false,
            rootCategory: "top-1",
            parentCategory: { id: "top-1", ordinal: BigInt(1) },
          },
        },
      ],
    });

    const result = await fetchCategoryHierarchy();
    expect(result).toHaveLength(1);
    expect(result[0].category.id).toBe("top-1");
    expect(result[0].subcategories).toHaveLength(1);
    expect(result[0].subcategories[0].id).toBe("sub-1");
  });

  it("sorts top-level categories by ordinal ascending", async () => {
    mockCatalogList.mockResolvedValue({
      data: [
        {
          type: "CATEGORY",
          id: "cat-b",
          categoryData: {
            name: "Wheels",
            isTopLevel: true,
            parentCategory: { ordinal: BigInt(2) },
          },
        },
        {
          type: "CATEGORY",
          id: "cat-a",
          categoryData: {
            name: "Skateboards",
            isTopLevel: true,
            parentCategory: { ordinal: BigInt(1) },
          },
        },
      ],
    });

    const result = await fetchCategoryHierarchy();
    expect(result[0].category.id).toBe("cat-a");
    expect(result[1].category.id).toBe("cat-b");
  });

  it("falls back to alphabetical order when ordinals are equal", async () => {
    mockCatalogList.mockResolvedValue({
      data: [
        {
          type: "CATEGORY",
          id: "cat-z",
          categoryData: {
            name: "Zephyr",
            isTopLevel: true,
            parentCategory: { ordinal: BigInt(1) },
          },
        },
        {
          type: "CATEGORY",
          id: "cat-a",
          categoryData: {
            name: "Alpha",
            isTopLevel: true,
            parentCategory: { ordinal: BigInt(1) },
          },
        },
      ],
    });

    const result = await fetchCategoryHierarchy();
    expect(result[0].category.name).toBe("Alpha");
    expect(result[1].category.name).toBe("Zephyr");
  });
});

describe("fetchProductsByCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passthroughGetOrCompute(mockCategoryGetOrCompute);
  });

  it("returns only products that belong to the given category", async () => {
    mockFetchProducts.mockResolvedValue([
      { id: "p1", categories: ["cat-1"], brand: "Baker" },
      { id: "p2", categories: ["cat-2"], brand: "Krooked" },
    ]);
    mockCatalogList.mockResolvedValue({ data: [] });

    const result = await fetchProductsByCategory("cat-1");
    expect(result.products.map((p: { id: string }) => p.id)).toEqual(["p1"]);
    expect(result.hasMore).toBe(false);
  });

  it("returns empty products array when no products match", async () => {
    mockFetchProducts.mockResolvedValue([
      { id: "p1", categories: ["cat-99"], brand: "Baker" },
    ]);
    mockCatalogList.mockResolvedValue({ data: [] });

    const result = await fetchProductsByCategory("cat-1");
    expect(result.products).toEqual([]);
  });

  it("matches products by reportingCategoryId", async () => {
    mockFetchProducts.mockResolvedValue([
      {
        id: "p1",
        categories: [],
        reportingCategoryId: "cat-1",
        brand: "Alien",
      },
      {
        id: "p2",
        categories: [],
        reportingCategoryId: "cat-2",
        brand: "Baker",
      },
    ]);
    mockCatalogList.mockResolvedValue({ data: [] });

    const result = await fetchProductsByCategory("cat-1");
    expect(result.products.map((p: { id: string }) => p.id)).toEqual(["p1"]);
  });

  it("handles API errors gracefully and returns empty products", async () => {
    mockFetchProducts.mockRejectedValue(new Error("Square down"));
    mockCatalogList.mockResolvedValue({ data: [] });
    mockProcessSquareError.mockReturnValue({ message: "Square down" });
    mockHandleError.mockReturnValue({ products: [], hasMore: false });

    const result = await fetchProductsByCategory("cat-1");
    expect(result.products).toEqual([]);
  });
});

describe("clearCategoryCache", () => {
  it("clears both category and product caches", () => {
    vi.clearAllMocks();
    clearCategoryCache();
    expect(mockCategoryClear).toHaveBeenCalledTimes(1);
    expect(mockProductClear).toHaveBeenCalledTimes(1);
  });
});
