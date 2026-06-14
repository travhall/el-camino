/**
 * BatchInventoryService (display adapter) tests
 *
 * Focus: the OPTIMISTIC failure policy and status derivation. The underlying
 * fetch is mocked so these tests assert only the adapter's mapping logic —
 * the core fetch/cache/fallback behavior is covered via inventory.test.ts.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockFetchInventoryCounts } = vi.hoisted(() => ({
  mockFetchInventoryCounts: vi.fn(),
}));

vi.mock("../inventoryCore", () => ({
  fetchInventoryCounts: mockFetchInventoryCounts,
}));

import { batchInventoryService } from "../batchInventory";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getBatchInventoryStatus", () => {
  it("returns an empty map for empty input without calling the core", async () => {
    const map = await batchInventoryService.getBatchInventoryStatus([]);
    expect(map.size).toBe(0);
    expect(mockFetchInventoryCounts).not.toHaveBeenCalled();
  });

  it("derives in-stock / limited / out-of-stock from quantities", async () => {
    mockFetchInventoryCounts.mockResolvedValue({
      counts: { a: 10, b: 2, c: 0 },
      failed: new Set(),
    });

    const map = await batchInventoryService.getBatchInventoryStatus(["a", "b", "c"]);

    expect(map.get("a")).toEqual({
      isOutOfStock: false,
      hasLimitedOptions: false,
      totalQuantity: 10,
      error: false,
    });
    expect(map.get("b")).toEqual({
      isOutOfStock: false,
      hasLimitedOptions: true, // 1..3 → limited
      totalQuantity: 2,
      error: false,
    });
    expect(map.get("c")).toEqual({
      isOutOfStock: true,
      hasLimitedOptions: false,
      totalQuantity: 0,
      error: false,
    });
  });

  it("marks unresolved IDs optimistically: kept in stock with error flag", async () => {
    mockFetchInventoryCounts.mockResolvedValue({
      counts: { a: 5 },
      failed: new Set(["b"]),
    });

    const map = await batchInventoryService.getBatchInventoryStatus(["a", "b"]);

    expect(map.get("a")?.error).toBe(false);
    // Optimistic policy — opposite of checkout's conservative 0.
    expect(map.get("b")).toEqual({
      isOutOfStock: false,
      hasLimitedOptions: false,
      totalQuantity: 0,
      error: true,
    });
  });

  it("dedupes repeated IDs in the returned map", async () => {
    mockFetchInventoryCounts.mockResolvedValue({
      counts: { a: 1 },
      failed: new Set(),
    });

    const map = await batchInventoryService.getBatchInventoryStatus(["a", "a"]);

    expect(map.size).toBe(1);
  });
});
