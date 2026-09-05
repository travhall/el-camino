/**
 * categoryLookup.ts unit tests
 *
 * Strategy: mock blobCache, requestDeduplication, and categories so we can
 * control category-hierarchy lookups and observe cache invalidation calls.
 * Focus is resolveCategoryPathWithRetry's retry/invalidation loop.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Category, CategoryHierarchy } from "../types";

// ── Hoist mock fn declarations ─────────────────────────────────────────────
const { mockCategoryGetOrCompute, mockCategoryDelete, mockDedupe, mockFetchCategoryHierarchy } =
  vi.hoisted(() => ({
    mockCategoryGetOrCompute: vi.fn(),
    mockCategoryDelete: vi.fn(),
    mockDedupe: vi.fn(),
    mockFetchCategoryHierarchy: vi.fn(),
  }));

vi.mock("@/lib/cache/blobCache", () => ({
  categoryCache: {
    getOrCompute: mockCategoryGetOrCompute,
    delete: mockCategoryDelete,
  },
}));

vi.mock("../requestDeduplication", () => ({
  requestDeduplicator: {
    dedupe: mockDedupe,
  },
}));

vi.mock("../categories", () => ({
  fetchCategoryHierarchy: mockFetchCategoryHierarchy,
}));

// ── Import after mocks ─────────────────────────────────────────────────────
import { resolveCategoryPathWithRetry } from "../categoryLookup";

// Passthrough dedupe: immediately invokes the provided function
function passthroughDedupe() {
  mockDedupe.mockImplementation((_key: string, fn: () => unknown) => fn());
}

// Passthrough getOrCompute: cache-miss-always, immediately invokes compute fn
function passthroughGetOrCompute() {
  mockCategoryGetOrCompute.mockImplementation(
    (_key: string, computeFn: () => unknown) => computeFn()
  );
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const fixtureHierarchy: CategoryHierarchy[] = [
  {
    category: { id: "cat-decks", name: "Decks", slug: "decks", isTopLevel: true },
    subcategories: [
      {
        id: "sub-mini-cruisers",
        name: "Mini Cruisers",
        slug: "mini-cruisers",
        isTopLevel: false,
      },
    ],
  },
  {
    category: { id: "cat-trucks", name: "Trucks", slug: "trucks", isTopLevel: true },
    subcategories: [],
  },
];

// A hierarchy that contains neither "decks" nor "trucks"/"mini-cruisers" - used
// to simulate a not-found-yet lookup that succeeds only after invalidation/retry.
const hierarchyMissingTargets: CategoryHierarchy[] = [
  {
    category: { id: "cat-other", name: "Other", slug: "other", isTopLevel: true },
    subcategories: [],
  },
];

describe("resolveCategoryPathWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    passthroughDedupe();
    passthroughGetOrCompute();
    mockCategoryDelete.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves on the first try without invalidating the cache", async () => {
    mockFetchCategoryHierarchy.mockResolvedValue(fixtureHierarchy);

    const result = await resolveCategoryPathWithRetry("decks");

    expect(result.category?.slug).toBe("decks");
    expect(mockCategoryDelete).not.toHaveBeenCalled();
  });

  it("retries after invalidating the cache when not found on the first attempt", async () => {
    mockFetchCategoryHierarchy
      .mockResolvedValueOnce(hierarchyMissingTargets) // attempt 0: getCategoryBySlug("decks") -> not found
      .mockResolvedValue(fixtureHierarchy); // attempt 1+: found

    const promise = resolveCategoryPathWithRetry("decks", 2);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.category?.slug).toBe("decks");
    expect(mockCategoryDelete).toHaveBeenCalledWith("category-by-slug:decks");
    expect(mockCategoryDelete).toHaveBeenCalledWith("nav-hierarchy");
    expect(mockCategoryDelete).toHaveBeenCalledWith("hierarchy-with-products");
  });

  it("gives up after exactly maxRetries + 1 attempts when never found", async () => {
    mockFetchCategoryHierarchy.mockResolvedValue(fixtureHierarchy);

    const promise = resolveCategoryPathWithRetry("nonexistent-slug", 2);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.category).toBeNull();
    expect(mockFetchCategoryHierarchy).toHaveBeenCalledTimes(3);
  });

  it("invalidates the cache for both slug parts of a nested path on retry", async () => {
    // resolveCategoryPath's two-segment branch resolves both slugs via
    // Promise.all, i.e. two concurrent getCategoryBySlug calls. Driving that
    // through fetchCategoryHierarchy (dynamic import) races two concurrent
    // `import('../categories')` calls against Vitest's mock registration, so
    // mock categoryCache.getOrCompute directly per cache key instead (per the
    // plan's suggested fallback) to avoid that race.
    const trucksCategory: Category = {
      id: "cat-trucks",
      name: "Trucks",
      slug: "trucks",
      isTopLevel: true,
    };
    const miniCruisersCategory: Category = {
      id: "sub-mini-cruisers",
      name: "Mini Cruisers",
      slug: "mini-cruisers",
      isTopLevel: false,
    };
    const callCounts: Record<string, number> = {};

    mockCategoryGetOrCompute.mockImplementation(
      async (cacheKey: string, computeFn: () => unknown) => {
        if (cacheKey === "category-by-slug:trucks") {
          callCounts[cacheKey] = (callCounts[cacheKey] ?? 0) + 1;
          return callCounts[cacheKey] === 1 ? null : trucksCategory;
        }
        if (cacheKey === "category-by-slug:mini-cruisers") {
          callCounts[cacheKey] = (callCounts[cacheKey] ?? 0) + 1;
          return callCounts[cacheKey] === 1 ? null : miniCruisersCategory;
        }
        return computeFn();
      }
    );

    const promise = resolveCategoryPathWithRetry("trucks/mini-cruisers");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.category?.slug).toBe("mini-cruisers");
    expect(mockCategoryDelete).toHaveBeenCalledWith("category-by-slug:trucks");
    expect(mockCategoryDelete).toHaveBeenCalledWith("category-by-slug:mini-cruisers");
    expect(mockCategoryDelete).toHaveBeenCalledWith("nav-hierarchy");
    expect(mockCategoryDelete).toHaveBeenCalledWith("hierarchy-with-products");
  });
});
