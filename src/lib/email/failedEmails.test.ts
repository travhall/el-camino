// src/lib/email/failedEmails.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FailedEmailRecord } from "./failedEmails";

// Mock @netlify/blobs — same pattern as src/lib/cache/__tests__/blobCache.test.ts
const mockBlobStore = {
  setJSON: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@netlify/blobs", () => ({
  getStore: vi.fn(() => mockBlobStore),
}));

// Import after mocks are set up
import {
  storeFailedEmail,
  getFailedEmail,
  listFailedEmails,
  deleteFailedEmail,
} from "./failedEmails";

const makeRecord = (overrides?: Partial<FailedEmailRecord>): FailedEmailRecord => ({
  orderId: "order-123",
  order: { id: "order-123", lineItems: [] } as any,
  contact: { email: "test@example.com", name: "Test User", fulfillmentMethod: "pickup" },
  failedAt: "2026-07-22T00:00:00.000Z",
  error: "Resend failed",
  ...overrides,
});

describe("failedEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("storeFailedEmail", () => {
    it("writes a record with the correct shape", async () => {
      mockBlobStore.setJSON.mockResolvedValue(undefined);

      const order = { id: "order-abc", lineItems: [] } as any;
      const contact = { email: "buyer@example.com", name: "Buyer", fulfillmentMethod: "shipping" as const };
      const error = new Error("Resend API timeout");

      await storeFailedEmail("order-abc", order, contact, error);

      expect(mockBlobStore.setJSON).toHaveBeenCalledOnce();
      const [key, record] = mockBlobStore.setJSON.mock.calls[0];
      expect(key).toBe("order-abc");
      expect(record.orderId).toBe("order-abc");
      expect(record.order).toEqual(order);
      expect(record.contact).toEqual(contact);
      expect(record.error).toBe("Resend API timeout");
      expect(record.failedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO timestamp
    });

    it("coerces non-Error throws to strings", async () => {
      mockBlobStore.setJSON.mockResolvedValue(undefined);

      const order = { id: "order-xyz" } as any;
      const contact = { email: "a@b.com", name: "A", fulfillmentMethod: "pickup" as const };

      await storeFailedEmail("order-xyz", order, contact, "plain string error");

      const [, record] = mockBlobStore.setJSON.mock.calls[0];
      expect(record.error).toBe("plain string error");
    });
  });

  describe("getFailedEmail", () => {
    it("returns the record when it exists", async () => {
      const record = makeRecord();
      mockBlobStore.get.mockResolvedValue(record);

      const result = await getFailedEmail("order-123");

      expect(result).toEqual(record);
      expect(mockBlobStore.get).toHaveBeenCalledWith("order-123", { type: "json" });
    });

    it("returns null when the record does not exist", async () => {
      mockBlobStore.get.mockResolvedValue(null);

      const result = await getFailedEmail("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("listFailedEmails", () => {
    it("returns an empty array when the store is empty", async () => {
      mockBlobStore.list.mockResolvedValue({ blobs: [] });

      const result = await listFailedEmails();

      expect(result).toEqual([]);
    });

    it("returns all records from the store", async () => {
      const record1 = makeRecord({ orderId: "order-1" });
      const record2 = makeRecord({ orderId: "order-2" });
      mockBlobStore.list.mockResolvedValue({
        blobs: [{ key: "order-1" }, { key: "order-2" }],
      });
      mockBlobStore.get
        .mockResolvedValueOnce(record1)
        .mockResolvedValueOnce(record2);

      const result = await listFailedEmails();

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(record1);
      expect(result).toContainEqual(record2);
    });

    it("filters out null entries (blobs that disappeared between list and get)", async () => {
      const record = makeRecord({ orderId: "order-1" });
      mockBlobStore.list.mockResolvedValue({
        blobs: [{ key: "order-1" }, { key: "order-gone" }],
      });
      mockBlobStore.get
        .mockResolvedValueOnce(record)
        .mockResolvedValueOnce(null);

      const result = await listFailedEmails();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(record);
    });
  });

  describe("deleteFailedEmail", () => {
    it("deletes the record from the store", async () => {
      mockBlobStore.delete.mockResolvedValue(undefined);

      await deleteFailedEmail("order-123");

      expect(mockBlobStore.delete).toHaveBeenCalledWith("order-123");
    });
  });
});
