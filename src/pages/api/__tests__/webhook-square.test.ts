import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies BEFORE importing the handler
vi.mock("@/lib/square/verifyWebhookSignature", () => ({
  verifySquareWebhookSignature: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/square/client", () => ({
  squareClient: {
    orders: {
      get: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache/blobCache", () => ({
  inventoryCache: { delete: vi.fn(), clear: vi.fn() },
  productCache: { delete: vi.fn(), clear: vi.fn() },
  categoryCache: { delete: vi.fn(), clear: vi.fn() },
  navigationCache: { delete: vi.fn(), clear: vi.fn() },
  slugCache: { delete: vi.fn(), clear: vi.fn() },
  filterCache: { delete: vi.fn(), clear: vi.fn() },
}));

vi.mock("@/lib/email/pendingOrders", () => ({
  getPendingOrder: vi.fn(),
  deletePendingOrder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email/sender", () => ({
  sendOrderConfirmation: vi.fn().mockResolvedValue(undefined),
  sendPickupNotification: vi.fn().mockResolvedValue(undefined),
  sendShippingOrderNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email/failedEmails", () => ({
  storeFailedEmail: vi.fn().mockResolvedValue(undefined),
}));

// Import handler AFTER mocks
import { POST } from "../webhooks/square";
import { verifySquareWebhookSignature } from "@/lib/square/verifyWebhookSignature";
import { squareClient } from "@/lib/square/client";
import { getPendingOrder, deletePendingOrder } from "@/lib/email/pendingOrders";
import {
  sendOrderConfirmation,
  sendPickupNotification,
  sendShippingOrderNotification,
} from "@/lib/email/sender";
import { storeFailedEmail } from "@/lib/email/failedEmails";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WEBHOOK_URL = "https://example.com/api/webhooks/square";

const mockContactPickup = {
  name: "Test User",
  email: "customer@example.com",
  fulfillmentMethod: "pickup",
  phone: "",
  notes: "",
};

const mockContactShipping = {
  ...mockContactPickup,
  fulfillmentMethod: "shipping",
};

const mockOrder = {
  id: "ORDER123456789012",
  totalMoney: { amount: 1999n, currency: "USD" },
  lineItems: [],
};

const paymentUpdatedCompleted = {
  type: "payment.updated",
  data: {
    object: {
      payment: {
        id: "PAY_001",
        order_id: "ORDER123456789012",
        status: "COMPLETED",
        total_money: { amount: 1999, currency: "USD" },
      },
    },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: object): Request {
  return new Request(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-square-hmacsha256-signature": "valid-sig",
    },
    body: JSON.stringify(body),
  });
}

function makeContext(body: object): any {
  return { request: makeRequest(body) };
}

// ── Test suite ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SQUARE_WEBHOOK_SIGNATURE_KEY", "test-secret");
  // Default: signature is valid
  vi.mocked(verifySquareWebhookSignature).mockReturnValue(true);
  // Default: orders.get succeeds
  vi.mocked(squareClient.orders.get).mockResolvedValue({ order: mockOrder } as any);
  // Default: no pending order (idempotency)
  vi.mocked(getPendingOrder).mockResolvedValue(null);
  vi.mocked(deletePendingOrder).mockResolvedValue(undefined);
});

describe("POST /api/webhooks/square", () => {
  // ── Env / config guard ────────────────────────────────────────────────────

  describe("env var guard", () => {
    it("returns 200 with received:false when SQUARE_WEBHOOK_SIGNATURE_KEY is missing", async () => {
      vi.stubEnv("SQUARE_WEBHOOK_SIGNATURE_KEY", "");
      const res = await POST(makeContext(paymentUpdatedCompleted));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.received).toBe(false);
    });
  });

  // ── Signature verification ────────────────────────────────────────────────

  describe("signature verification", () => {
    it("returns 403 when signature is invalid", async () => {
      vi.mocked(verifySquareWebhookSignature).mockReturnValue(false);
      const res = await POST(makeContext(paymentUpdatedCompleted));
      expect(res.status).toBe(403);
    });
  });

  // ── payment.updated / COMPLETED — happy path (pickup) ────────────────────

  describe("payment.updated COMPLETED — pickup", () => {
    beforeEach(() => {
      vi.mocked(getPendingOrder).mockResolvedValue(mockContactPickup as any);
    });

    it("returns 200", async () => {
      const res = await POST(makeContext(paymentUpdatedCompleted));
      expect(res.status).toBe(200);
    });

    it("returns received:true in body", async () => {
      const res = await POST(makeContext(paymentUpdatedCompleted));
      const body = await res.json();
      expect(body.received).toBe(true);
    });

    it("calls sendOrderConfirmation with the order and contact", async () => {
      await POST(makeContext(paymentUpdatedCompleted));
      expect(sendOrderConfirmation).toHaveBeenCalledOnce();
      expect(sendOrderConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ contact: mockContactPickup })
      );
    });

    it("calls sendPickupNotification for pickup fulfillment", async () => {
      await POST(makeContext(paymentUpdatedCompleted));
      expect(sendPickupNotification).toHaveBeenCalledOnce();
    });

    it("does NOT call sendShippingOrderNotification for pickup", async () => {
      await POST(makeContext(paymentUpdatedCompleted));
      expect(sendShippingOrderNotification).not.toHaveBeenCalled();
    });

    it("calls deletePendingOrder to guard against duplicate delivery", async () => {
      await POST(makeContext(paymentUpdatedCompleted));
      expect(deletePendingOrder).toHaveBeenCalledWith("ORDER123456789012");
    });
  });

  // ── payment.updated / COMPLETED — happy path (shipping) ──────────────────

  describe("payment.updated COMPLETED — shipping", () => {
    beforeEach(() => {
      vi.mocked(getPendingOrder).mockResolvedValue(mockContactShipping as any);
    });

    it("calls sendShippingOrderNotification for shipping fulfillment", async () => {
      await POST(makeContext(paymentUpdatedCompleted));
      expect(sendShippingOrderNotification).toHaveBeenCalledOnce();
    });

    it("does NOT call sendPickupNotification for shipping", async () => {
      await POST(makeContext(paymentUpdatedCompleted));
      expect(sendPickupNotification).not.toHaveBeenCalled();
    });
  });

  // ── Idempotency guard ─────────────────────────────────────────────────────

  describe("payment.updated COMPLETED — no pending order (idempotency)", () => {
    it("skips email sending and returns 200 when no pending order is found", async () => {
      vi.mocked(getPendingOrder).mockResolvedValue(null);
      const res = await POST(makeContext(paymentUpdatedCompleted));
      expect(res.status).toBe(200);
      expect(sendOrderConfirmation).not.toHaveBeenCalled();
      expect(deletePendingOrder).not.toHaveBeenCalled();
    });
  });

  // ── orders.get fallback path ──────────────────────────────────────────────

  describe("payment.updated COMPLETED — Square orders.get fails (fallback)", () => {
    beforeEach(() => {
      vi.mocked(getPendingOrder).mockResolvedValue(mockContactPickup as any);
      vi.mocked(squareClient.orders.get).mockRejectedValue(
        new Error("Square API unavailable")
      );
    });

    it("still calls sendOrderConfirmation using payment-payload fallback order", async () => {
      const res = await POST(makeContext(paymentUpdatedCompleted));
      expect(res.status).toBe(200);
      expect(sendOrderConfirmation).toHaveBeenCalledOnce();
    });

    it("still deletes the pending order blob after fallback-path email send", async () => {
      await POST(makeContext(paymentUpdatedCompleted));
      expect(deletePendingOrder).toHaveBeenCalledWith("ORDER123456789012");
    });
  });

  // ── Email failure path ────────────────────────────────────────────────────
  // Plan 038: on email failure the handler calls storeFailedEmail() instead
  // of re-throwing, so Square still gets 200 and the blob stays intact for retry.

  describe("payment.updated COMPLETED — email delivery fails", () => {
    beforeEach(() => {
      vi.mocked(getPendingOrder).mockResolvedValue(mockContactPickup as any);
      vi.mocked(sendOrderConfirmation).mockRejectedValue(
        new Error("Resend API error")
      );
    });

    it("returns 200 even when sendOrderConfirmation throws", async () => {
      const res = await POST(makeContext(paymentUpdatedCompleted));
      expect(res.status).toBe(200);
    });

    it("calls storeFailedEmail to persist the failure for admin retry", async () => {
      await POST(makeContext(paymentUpdatedCompleted));
      expect(storeFailedEmail).toHaveBeenCalledWith(
        "ORDER123456789012",
        expect.anything(),
        mockContactPickup,
        expect.any(Error)
      );
    });

    it("does NOT call deletePendingOrder when email sending fails", async () => {
      // Idempotency blob stays intact so the order can be retried from admin UI.
      await POST(makeContext(paymentUpdatedCompleted));
      expect(deletePendingOrder).not.toHaveBeenCalled();
    });
  });

  // ── Non-COMPLETED payment status ──────────────────────────────────────────

  describe("payment.updated with non-COMPLETED status", () => {
    it("ignores PENDING payments and returns 200 without sending emails", async () => {
      vi.mocked(getPendingOrder).mockResolvedValue(mockContactPickup as any);
      const pendingEvent = {
        type: "payment.updated",
        data: {
          object: {
            payment: {
              id: "PAY_002",
              order_id: "ORDER123456789012",
              status: "PENDING",
              total_money: { amount: 1999, currency: "USD" },
            },
          },
        },
      };
      const res = await POST(makeContext(pendingEvent));
      expect(res.status).toBe(200);
      expect(sendOrderConfirmation).not.toHaveBeenCalled();
    });
  });

  // ── Unhandled event types ─────────────────────────────────────────────────

  describe("unhandled event types", () => {
    it("returns 200 for an unknown event type without sending any emails", async () => {
      const res = await POST(makeContext({ type: "unknown.event", data: {} }));
      expect(res.status).toBe(200);
      expect(sendOrderConfirmation).not.toHaveBeenCalled();
    });
  });
});
