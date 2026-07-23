import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/admin/auth", () => ({
  isAdminAuthenticated: vi.fn().mockReturnValue(true),
  parseAdminFormData: vi.fn(async (request: Request) => {
    try {
      return await request.formData();
    } catch {
      return null;
    }
  }),
}));

vi.mock("@/lib/square/client", () => ({
  squareClient: {
    orders: {
      get: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email/sender", () => ({
  sendShippingConfirmation: vi.fn(),
}));

import { POST } from "../mark-shipped";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { squareClient } from "@/lib/square/client";
import { sendShippingConfirmation } from "@/lib/email/sender";

const URL_BASE = "https://example.com/api/admin/mark-shipped";

function makeContext(fields: Record<string, string>): any {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  const request = new Request(URL_BASE, { method: "POST", body: formData });
  return {
    request,
    cookies: {} as any,
    redirect: (url: string) =>
      new Response(null, { status: 302, headers: { Location: url } }),
  };
}

const orderWithFulfillment = (state: string, overrides: Record<string, unknown> = {}) => ({
  order: {
    locationId: "LOC1",
    version: 3,
    fulfillments: [
      {
        uid: "fulfillment-1",
        type: "SHIPMENT",
        state,
        shipmentDetails: {
          recipient: { emailAddress: "customer@example.com", displayName: "Test Customer" },
        },
        ...overrides,
      },
    ],
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAdminAuthenticated).mockReturnValue(true);
});

describe("POST /api/admin/mark-shipped", () => {
  it("redirects to login when not authenticated", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const res = await POST(makeContext({ orderId: "order-1" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/admin/login");
  });

  it("returns 400 when orderId is missing", async () => {
    const res = await POST(makeContext({}));
    expect(res.status).toBe(400);
  });

  it("redirects with a no-email error when the recipient has no email address", async () => {
    vi.mocked(squareClient.orders.get).mockResolvedValue(
      orderWithFulfillment("PROPOSED", { shipmentDetails: {} }) as any,
    );
    const res = await POST(makeContext({ orderId: "order-1" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("error=no-email");
  });

  it("redirects with a fetch error when the order can't be retrieved", async () => {
    vi.mocked(squareClient.orders.get).mockRejectedValue(new Error("not found"));
    const res = await POST(makeContext({ orderId: "order-1" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("error=fetch");
  });

  it("walks PROPOSED -> RESERVED -> COMPLETED, attaches tracking only on the final step, sends confirmation, and redirects", async () => {
    vi.mocked(squareClient.orders.get).mockResolvedValue(orderWithFulfillment("PROPOSED") as any);
    vi.mocked(squareClient.orders.update).mockResolvedValue({} as any);
    vi.mocked(sendShippingConfirmation).mockResolvedValue(undefined as any);

    const res = await POST(
      makeContext({ orderId: "order-1", trackingNumber: "1Z999", carrier: "UPS" }),
    );

    expect(squareClient.orders.update).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(squareClient.orders.update).mock.calls;
    const [firstCall] = calls[0]!;
    const [secondCall] = calls[1]!;
    expect((firstCall as any).order.fulfillments[0].state).toBe("RESERVED");
    expect((firstCall as any).order.fulfillments[0].shipmentDetails).toBeUndefined();
    expect((secondCall as any).order.fulfillments[0].state).toBe("COMPLETED");
    expect((secondCall as any).order.fulfillments[0].shipmentDetails).toEqual({
      trackingNumber: "1Z999",
      carrier: "UPS",
    });

    expect(sendShippingConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        contact: {
          email: "customer@example.com",
          name: "Test Customer",
          fulfillmentMethod: "shipping",
        },
        trackingNumber: "1Z999",
        carrier: "UPS",
      }),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("shipped=1");
  });

  it("redirects with an update error when Square rejects the state transition", async () => {
    vi.mocked(squareClient.orders.get).mockResolvedValue(orderWithFulfillment("PROPOSED") as any);
    vi.mocked(squareClient.orders.update).mockRejectedValue(new Error("Square update failed"));

    const res = await POST(makeContext({ orderId: "order-1" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("error=update");
  });

  it("redirects with an email error when the Square update succeeds but the confirmation email fails", async () => {
    // RESERVED has exactly one remaining step (-> COMPLETED); the fulfillment
    // lookup itself excludes already-COMPLETED orders, so that state can't be
    // used to reach the email-sending path with zero update() calls.
    vi.mocked(squareClient.orders.get).mockResolvedValue(orderWithFulfillment("RESERVED") as any);
    vi.mocked(squareClient.orders.update).mockResolvedValue({} as any);
    vi.mocked(sendShippingConfirmation).mockRejectedValue(new Error("Resend down"));

    const res = await POST(makeContext({ orderId: "order-1" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("error=email");
  });
});
