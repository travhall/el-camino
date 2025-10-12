// src/lib/square/services/__tests__/InventoryService.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { InventoryService } from "../InventoryService";
import type { Client } from "square/legacy";
import type { CircuitBreaker } from "../../apiUtils";
import { Cache } from "../../cacheUtils";
import type { Product } from "../../types";

describe("InventoryService", () => {
  let mockClient: Client;
  let mockCircuitBreaker: CircuitBreaker;
  let service: InventoryService;
  let cache: Cache<number>;

  beforeEach(() => {
    // Mock Square client with inventory API
    mockClient = {
      inventoryApi: {
        retrieveInventoryCount: vi.fn(),
        batchRetrieveInventoryCounts: vi.fn(),
      },
    } as unknown as Client;

    // Mock circuit breaker
    mockCircuitBreaker = {
      execute: vi.fn((fn) => fn()),
    } as unknown as CircuitBreaker;

    // Create cache
    cache = new Cache("test-inventory", 60);

    // Create service
    service = new InventoryService(
      mockClient,
      mockCircuitBreaker,
      { locationId: "test-location" },
      cache
    );
  });

  describe("checkInventory", () => {
    it("should return quantity for in-stock item", async () => {
      const mockResponse = {
        result: {
          counts: [
            {
              state: "IN_STOCK",
              quantity: "10",
            },
          ],
        },
      };

      vi.mocked(mockClient.inventoryApi.retrieveInventoryCount).mockResolvedValue(
        mockResponse as any
      );

      const quantity = await service.checkInventory("var-123");

      expect(quantity).toBe(10);
      expect(mockClient.inventoryApi.retrieveInventoryCount).toHaveBeenCalledWith(
        "var-123"
      );
    });

    it("should return 0 for out-of-stock item", async () => {
      const mockResponse = {
        result: {
          counts: [],
        },
      };

      vi.mocked(mockClient.inventoryApi.retrieveInventoryCount).mockResolvedValue(
        mockResponse as any
      );

      const quantity = await service.checkInventory("var-456");

      expect(quantity).toBe(0);
    });

    it("should use cache on second call", async () => {
      const mockResponse = {
        result: {
          counts: [{ state: "IN_STOCK", quantity: "5" }],
        },
      };

      vi.mocked(mockClient.inventoryApi.retrieveInventoryCount).mockResolvedValue(
        mockResponse as any
      );

      // First call
      await service.checkInventory("var-789");

      // Second call (should use cache)
      const quantity = await service.checkInventory("var-789");

      expect(quantity).toBe(5);
      // Should only call API once
      expect(mockClient.inventoryApi.retrieveInventoryCount).toHaveBeenCalledTimes(
        1
      );
    });
  });

  describe("isInStock", () => {
    it("should return true for in-stock item", async () => {
      const mockResponse = {
        result: {
          counts: [{ state: "IN_STOCK", quantity: "3" }],
        },
      };

      vi.mocked(mockClient.inventoryApi.retrieveInventoryCount).mockResolvedValue(
        mockResponse as any
      );

      const inStock = await service.isInStock("var-111");

      expect(inStock).toBe(true);
    });

    it("should return false for out-of-stock item", async () => {
      const mockResponse = {
        result: {
          counts: [],
        },
      };

      vi.mocked(mockClient.inventoryApi.retrieveInventoryCount).mockResolvedValue(
        mockResponse as any
      );

      const inStock = await service.isInStock("var-222");

      expect(inStock).toBe(false);
    });
  });

  describe("checkBulkInventory", () => {
    it("should handle empty array", async () => {
      const result = await service.checkBulkInventory([]);

      expect(result).toEqual({});
    });

    it("should batch check multiple items", async () => {
      const mockResponse = {
        result: {
          counts: [
            { state: "IN_STOCK", catalogObjectId: "var-1", quantity: "5" },
            { state: "IN_STOCK", catalogObjectId: "var-2", quantity: "10" },
          ],
        },
      };

      vi.mocked(
        mockClient.inventoryApi.batchRetrieveInventoryCounts
      ).mockResolvedValue(mockResponse as any);

      const result = await service.checkBulkInventory(["var-1", "var-2"]);

      expect(result).toEqual({
        "var-1": 5,
        "var-2": 10,
      });
    });

    it("should deduplicate variation IDs", async () => {
      const mockResponse = {
        result: {
          counts: [{ state: "IN_STOCK", catalogObjectId: "var-1", quantity: "3" }],
        },
      };

      vi.mocked(
        mockClient.inventoryApi.batchRetrieveInventoryCounts
      ).mockResolvedValue(mockResponse as any);

      const result = await service.checkBulkInventory([
        "var-1",
        "var-1",
        "var-1",
      ]);

      expect(result).toEqual({ "var-1": 3 });
      // Should only call API once despite duplicates
      expect(
        mockClient.inventoryApi.batchRetrieveInventoryCounts
      ).toHaveBeenCalledTimes(1);
    });

    it("should return 0 for items not in IN_STOCK state", async () => {
      const mockResponse = {
        result: {
          counts: [
            { state: "IN_STOCK", catalogObjectId: "var-1", quantity: "5" },
            // var-2 not returned = out of stock
          ],
        },
      };

      vi.mocked(
        mockClient.inventoryApi.batchRetrieveInventoryCounts
      ).mockResolvedValue(mockResponse as any);

      const result = await service.checkBulkInventory(["var-1", "var-2"]);

      expect(result).toEqual({
        "var-1": 5,
        "var-2": 0,
      });
    });
  });

  describe("getProductStockStatus", () => {
    it("should detect all variations out of stock", async () => {
      const product: Product = {
        id: "prod-1",
        catalogObjectId: "cat-1",
        variationId: "var-1",
        title: "Test Product",
        image: "test.jpg",
        price: 1000,
        url: "/product/test",
        variations: [
          { variationId: "var-1" } as any,
          { variationId: "var-2" } as any,
        ],
      };

      const mockResponse = {
        result: {
          counts: [], // All out of stock
        },
      };

      vi.mocked(
        mockClient.inventoryApi.batchRetrieveInventoryCounts
      ).mockResolvedValue(mockResponse as any);

      const status = await service.getProductStockStatus(product);

      expect(status).toEqual({
        isOutOfStock: true,
        hasLimitedOptions: false,
      });
    });

    it("should detect limited options (some in stock)", async () => {
      const product: Product = {
        id: "prod-1",
        catalogObjectId: "cat-1",
        variationId: "var-1",
        title: "Test Product",
        image: "test.jpg",
        price: 1000,
        url: "/product/test",
        variations: [
          { variationId: "var-1" } as any,
          { variationId: "var-2" } as any,
        ],
      };

      const mockResponse = {
        result: {
          counts: [
            { state: "IN_STOCK", catalogObjectId: "var-1", quantity: "5" },
            // var-2 out of stock
          ],
        },
      };

      vi.mocked(
        mockClient.inventoryApi.batchRetrieveInventoryCounts
      ).mockResolvedValue(mockResponse as any);

      const status = await service.getProductStockStatus(product);

      expect(status).toEqual({
        isOutOfStock: false,
        hasLimitedOptions: true,
      });
    });
  });

  describe("webhook integration", () => {
    it("should update cache on inventory webhook event", () => {
      // Pre-populate cache with old value
      cache.set("var-123", 5);

      // Webhook event
      service.onInventoryUpdate({
        catalogObjectId: "var-123",
        quantity: 10,
      });

      // Cache should be updated
      expect(cache.get("var-123")).toBe(10);
    });
  });

  describe("getStats", () => {
    it("should return service statistics", () => {
      const stats = service.getStats();

      expect(stats).toHaveProperty("service");
      expect(stats).toHaveProperty("locationId");
      expect(stats.service).toBe("InventoryService");
      expect(stats.locationId).toBe("test-location");
    });
  });
});
