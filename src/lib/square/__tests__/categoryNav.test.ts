/**
 * categoryNav.ts unit tests
 *
 * Strategy: mock squareClient, blobCache, requestDeduplication, and apiRetry
 * so we can control inputs. filterCategoryHierarchyWithProducts and
 * batchCheckCategoriesHaveProducts are the main pure-ish utilities tested here.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Hoist mock fn declarations ─────────────────────────────────────────────
const {
  mockSearchItems,
  mockCategoryGet,
  mockCategorySet,
  mockCategoryGetOrCompute,
  mockNavigationGetOrCompute,
  mockDedupe,
  mockExecuteWithRetry,
  mockProcessSquareError,
  mockHandleError,
  mockFetchProducts,
  mockFetchCategoryHierarchy,
} = vi.hoisted(() => ({
  mockSearchItems: vi.fn(),
  mockCategoryGet: vi.fn(),
  mockCategorySet: vi.fn(),
  mockCategoryGetOrCompute: vi.fn(),
  mockNavigationGetOrCompute: vi.fn(),
  mockDedupe: vi.fn(),
  mockExecuteWithRetry: vi.fn(),
  mockProcessSquareError: vi.fn(),
  mockHandleError: vi.fn(),
  mockFetchProducts: vi.fn(),
  mockFetchCategoryHierarchy: vi.fn(),
}));

vi.mock("../client", () => ({
  squareClient: {
    catalog: {
      searchItems: mockSearchItems,
    },
  },
  fetchProducts: mockFetchProducts,
}));

vi.mock("@/lib/cache/blobCache", () => ({
  categoryCache: {
    get: mockCategoryGet,
    set: mockCategorySet,
    getOrCompute: mockCategoryGetOrCompute,
  },
  navigationCache: {
    getOrCompute: mockNavigationGetOrCompute,
  },
}));

vi.mock("../requestDeduplication", () => ({
  requestDeduplicator: {
    dedupe: mockDedupe,
  },
}));

vi.mock("../apiRetry", () => ({
  catalogRetryClient: {
    executeWithRetry: mockExecuteWithRetry,
  },
}));

vi.mock("../serverErrorUtils", () => ({
  processSquareError: mockProcessSquareError,
}));

vi.mock("../errorUtils", () => ({
  handleError: mockHandleError,
}));

vi.mock("./categories", () => ({
  fetchCategoryHierarchy: mockFetchCategoryHierarchy,
}));

// ── Import after mocks ─────────────────────────────────────────────────────
import {
  categoryHasProducts,
  batchCheckCategoriesHaveProducts,
  filterCategoryHierarchyWithProducts,
} from "../categoryNav";
import type { CategoryHierarchy } from "../types";

// Passthrough dedupe: immediately invokes the provided function
function passthroughDedupe() {
  mockDedupe.mockImplementation(
    (_key: string, fn: () => unknown) => fn()
  );
}

// Passthrough getOrCompute: immediately invokes compute fn
function passthroughGetOrCompute(mockFn: ReturnType<typeof vi.fn>) {
  mockFn.mockImplementation(
    (_key: string, computeFn: () => unknown) => computeFn()
  );
}

// ── categoryHasProducts ────────────────────────────────────────────────────

describe("categoryHasProducts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passthroughDedupe();
    passthroughGetOrCompute(mockCategoryGetOrCompute);
  });

  it("returns true when searchItems finds at least one item", async () => {
    mockExecuteWithRetry.mockImplementation(
      (fn: () => unknown) => fn()
    );
    mockSearchItems.mockResolvedValue({ items: [{ id: "item-1" }] });

    const result = await categoryHasProducts("cat-1");
    expect(result).toBe(true);
  });

  it("returns false when searchItems returns empty items", async () => {
    mockExecuteWithRetry.mockImplementation(
      (fn: () => unknown) => fn()
    );
    mockSearchItems.mockResolvedValue({ items: [] });

    const result = await categoryHasProducts("cat-1");
    expect(result).toBe(false);
  });

  it("returns false when searchItems returns undefined items", async () => {
    mockExecuteWithRetry.mockImplementation(
      (fn: () => unknown) => fn()
    );
    mockSearchItems.mockResolvedValue({});

    const result = await categoryHasProducts("cat-1");
    expect(result).toBe(false);
  });

  it("fails open (returns true) and calls handleError on error", async () => {
    const err = new Error("Square timeout");
    mockExecuteWithRetry.mockRejectedValue(err);
    mockProcessSquareError.mockReturnValue({ message: "Square timeout" });
    mockHandleError.mockReturnValue(true);

    const result = await categoryHasProducts("cat-1");
    expect(mockProcessSquareError).toHaveBeenCalled();
    expect(mockHandleError).toHaveBeenCalledWith(expect.anything(), true);
    expect(result).toBe(true);
  });
});

// ── batchCheckCategoriesHaveProducts ──────────────────────────────────────

describe("batchCheckCategoriesHaveProducts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passthroughDedupe();
  });

  it("derives has-products from fetchProducts categories array", async () => {
    // Nothing cached
    mockCategoryGet.mockResolvedValue(undefined);
    mockFetchProducts.mockResolvedValue([
      { id: "p1", categories: ["cat-1"], reportingCategoryId: undefined },
    ]);
    mockCategorySet.mockResolvedValue(undefined);

    const result = await batchCheckCategoriesHaveProducts(["cat-1", "cat-2"]);
    expect(result["cat-1"]).toBe(true);
    expect(result["cat-2"]).toBe(false);
  });

  it("picks up reportingCategoryId as a category presence signal", async () => {
    mockCategoryGet.mockResolvedValue(undefined);
    mockFetchProducts.mockResolvedValue([
      { id: "p1", categories: [], reportingCategoryId: "cat-reporting" },
    ]);
    mockCategorySet.mockResolvedValue(undefined);

    const result = await batchCheckCategoriesHaveProducts([
      "cat-reporting",
      "cat-empty",
    ]);
    expect(result["cat-reporting"]).toBe(true);
    expect(result["cat-empty"]).toBe(false);
  });

  it("uses cached values and skips API for already-cached categories", async () => {
    // cat-1 is already cached
    mockCategoryGet.mockImplementation(
      async (key: string) => (key === "category-has-products:cat-1" ? true : undefined)
    );
    mockFetchProducts.mockResolvedValue([]);
    mockCategorySet.mockResolvedValue(undefined);

    const result = await batchCheckCategoriesHaveProducts(["cat-1"]);
    expect(result["cat-1"]).toBe(true);
    // fetchProducts should not have been called since everything was cached
    expect(mockFetchProducts).not.toHaveBeenCalled();
  });

  it("fails open (defaults to true) when fetchProducts throws", async () => {
    mockCategoryGet.mockResolvedValue(undefined);
    mockFetchProducts.mockRejectedValue(new Error("Network error"));
    mockProcessSquareError.mockReturnValue({ message: "Network error" });
    mockHandleError.mockReturnValue(null);

    const result = await batchCheckCategoriesHaveProducts(["cat-x"]);
    expect(result["cat-x"]).toBe(true);
  });
});

// ── filterCategoryHierarchyWithProducts ───────────────────────────────────

describe("filterCategoryHierarchyWithProducts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passthroughDedupe();
  });

  it("returns empty array for empty input hierarchy", async () => {
    const result = await filterCategoryHierarchyWithProducts([]);
    expect(result).toEqual([]);
  });

  it("keeps category that directly has products", async () => {
    mockCategoryGet.mockResolvedValue(undefined);
    mockFetchProducts.mockResolvedValue([
      { id: "p1", categories: ["cat-1"] },
    ]);
    mockCategorySet.mockResolvedValue(undefined);

    const hierarchy: CategoryHierarchy[] = [
      {
        category: {
          id: "cat-1",
          name: "Skateboards",
          slug: "skateboards",
          isTopLevel: true,
        },
        subcategories: [],
      },
    ];

    const result = await filterCategoryHierarchyWithProducts(hierarchy);
    expect(result).toHaveLength(1);
    expect(result[0].category.id).toBe("cat-1");
  });

  it("excludes category with zero products from the nav result", async () => {
    mockCategoryGet.mockResolvedValue(undefined);
    mockFetchProducts.mockResolvedValue([]);
    mockCategorySet.mockResolvedValue(undefined);

    const hierarchy: CategoryHierarchy[] = [
      {
        category: {
          id: "cat-empty",
          name: "Empty",
          slug: "empty",
          isTopLevel: true,
        },
        subcategories: [],
      },
    ];

    const result = await filterCategoryHierarchyWithProducts(hierarchy);
    expect(result).toHaveLength(0);
  });

  it("keeps parent category when only a subcategory has products", async () => {
    mockCategoryGet.mockResolvedValue(undefined);
    mockFetchProducts.mockResolvedValue([
      { id: "p1", categories: ["sub-1"] },
    ]);
    mockCategorySet.mockResolvedValue(undefined);

    const hierarchy: CategoryHierarchy[] = [
      {
        category: {
          id: "parent-1",
          name: "Skateboards",
          slug: "skateboards",
          isTopLevel: true,
        },
        subcategories: [
          {
            id: "sub-1",
            name: "Decks",
            slug: "decks",
            isTopLevel: false,
          },
        ],
      },
    ];

    const result = await filterCategoryHierarchyWithProducts(hierarchy);
    expect(result).toHaveLength(1);
    expect(result[0].subcategories).toHaveLength(1);
    expect(result[0].subcategories[0].id).toBe("sub-1");
  });

  it("strips subcategories with no products while retaining parent", async () => {
    mockCategoryGet.mockResolvedValue(undefined);
    mockFetchProducts.mockResolvedValue([
      { id: "p1", categories: ["parent-1"] },
    ]);
    mockCategorySet.mockResolvedValue(undefined);

    const hierarchy: CategoryHierarchy[] = [
      {
        category: {
          id: "parent-1",
          name: "Skateboards",
          slug: "skateboards",
          isTopLevel: true,
        },
        subcategories: [
          {
            id: "sub-empty",
            name: "Empty Sub",
            slug: "empty-sub",
            isTopLevel: false,
          },
        ],
      },
    ];

    const result = await filterCategoryHierarchyWithProducts(hierarchy);
    expect(result).toHaveLength(1);
    // Sub with no products is stripped
    expect(result[0].subcategories).toHaveLength(0);
  });

  it("preserves ordering from the original hierarchy", async () => {
    mockCategoryGet.mockResolvedValue(undefined);
    mockFetchProducts.mockResolvedValue([
      { id: "p1", categories: ["cat-a"] },
      { id: "p2", categories: ["cat-b"] },
    ]);
    mockCategorySet.mockResolvedValue(undefined);

    const hierarchy: CategoryHierarchy[] = [
      {
        category: {
          id: "cat-a",
          name: "Alpha",
          slug: "alpha",
          isTopLevel: true,
        },
        subcategories: [],
      },
      {
        category: {
          id: "cat-b",
          name: "Beta",
          slug: "beta",
          isTopLevel: true,
        },
        subcategories: [],
      },
    ];

    const result = await filterCategoryHierarchyWithProducts(hierarchy);
    expect(result[0].category.id).toBe("cat-a");
    expect(result[1].category.id).toBe("cat-b");
  });
});
