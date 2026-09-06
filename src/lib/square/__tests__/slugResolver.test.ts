/**
 * slugResolver.ts unit tests
 *
 * Strategy: mock squareInstance (the underlying Square client used by
 * fetchAllCatalogItems) and blobCache so buildSlugMap's pagination can be
 * exercised end-to-end through the real fetchAllCatalogItems implementation.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockCatalogList, mockSlugCacheGet, mockSlugCacheSet } = vi.hoisted(
  () => ({
    mockCatalogList: vi.fn(),
    mockSlugCacheGet: vi.fn(),
    mockSlugCacheSet: vi.fn(),
  })
);

vi.mock("../squareInstance", () => ({
  squareClient: {
    catalog: {
      list: mockCatalogList,
    },
  },
  validateEnvironment: vi.fn(),
}));

vi.mock("../../cache/blobCache", () => ({
  slugCache: {
    get: mockSlugCacheGet,
    set: mockSlugCacheSet,
    delete: vi.fn(),
  },
}));

// Import after mocks
import { slugResolver } from "../slugResolver";

function item(id: string, name: string) {
  return { type: "ITEM", id, itemData: { name } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSlugCacheGet.mockResolvedValue(null);
  mockSlugCacheSet.mockResolvedValue(undefined);
});

describe("slugResolver buildSlugMap pagination", () => {
  it("includes items from both pages of a two-page catalog", async () => {
    mockCatalogList
      .mockResolvedValueOnce({
        data: [item("1", "First Item")],
        response: { cursor: "page-2-cursor" },
      })
      .mockResolvedValueOnce({
        data: [item("2", "Second Item")],
        response: { cursor: undefined },
      });

    const id = await slugResolver.resolve("second-item");

    expect(mockCatalogList).toHaveBeenCalledTimes(2);
    expect(mockCatalogList.mock.calls[1][0]).toMatchObject({
      cursor: "page-2-cursor",
    });
    expect(id).toBe("2");
    const cachedMap = mockSlugCacheSet.mock.calls[0][1];
    expect(cachedMap).toEqual({
      "first-item": "1",
      "second-item": "2",
    });
  });

  it("behaves unchanged for a single-page catalog", async () => {
    mockCatalogList.mockResolvedValueOnce({
      data: [item("1", "Only Item")],
      response: { cursor: undefined },
    });

    const id = await slugResolver.resolve("only-item");

    expect(mockCatalogList).toHaveBeenCalledTimes(1);
    expect(id).toBe("1");
  });

  it("stops at MAX_CATALOG_PAGES and warns", async () => {
    mockCatalogList.mockImplementation(() =>
      Promise.resolve({
        data: [],
        response: { cursor: "always-more" },
      })
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await slugResolver.resolve("anything");

    expect(mockCatalogList).toHaveBeenCalledTimes(20);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Hit max requests limit")
    );

    warnSpy.mockRestore();
  });

  it("skips an item without itemData.name", async () => {
    mockCatalogList.mockResolvedValueOnce({
      data: [
        { type: "ITEM", id: "1", itemData: {} },
        item("2", "Named Item"),
      ],
      response: { cursor: undefined },
    });

    const namedId = await slugResolver.resolve("named-item");
    expect(namedId).toBe("2");

    const cachedMap = mockSlugCacheSet.mock.calls[0][1];
    expect(Object.values(cachedMap)).not.toContain("1");
  });

  it("returns an empty map and does not throw on a Square error mid-pagination", async () => {
    mockCatalogList
      .mockResolvedValueOnce({
        data: [item("1", "First Item")],
        response: { cursor: "page-2-cursor" },
      })
      .mockRejectedValueOnce(new Error("Square API error"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const id = await slugResolver.resolve("first-item");

    expect(id).toBeNull();
    expect(mockSlugCacheSet).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
