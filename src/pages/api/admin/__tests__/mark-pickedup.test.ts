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

import { POST } from "../mark-pickedup";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { squareClient } from "@/lib/square/client";

const URL_BASE = "https://example.com/api/admin/mark-pickedup";

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

const orderWithFulfillment = (state: string, uid = "fulfillment-1") => ({
  order: {
    locationId: "LOC1",
    version: 3,
    fulfillments: [{ uid, type: "PICKUP", state }],
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAdminAuthenticated).mockReturnValue(true);
});

describe("POST /api/admin/mark-pickedup", () => {
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

  it("redirects with a fetch error when the order can't be retrieved", async () => {
    vi.mocked(squareClient.orders.get).mockRejectedValue(new Error("not found"));
    const res = await POST(makeContext({ orderId: "order-1" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("error=fetch");
  });

  it("walks PROPOSED -> RESERVED -> PREPARED -> COMPLETED and redirects with completed=1", async () => {
    vi.mocked(squareClient.orders.get).mockResolvedValue(orderWithFulfillment("PROPOSED") as any);
    vi.mocked(squareClient.orders.update).mockResolvedValue({} as any);

    const res = await POST(makeContext({ orderId: "order-1" }));

    expect(squareClient.orders.update).toHaveBeenCalledTimes(3);
    const states = vi.mocked(squareClient.orders.update).mock.calls.map(
      ([arg]: any) => arg.order.fulfillments[0].state,
    );
    expect(states).toEqual(["RESERVED", "PREPARED", "COMPLETED"]);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("completed=1");
  });

  it("only takes the remaining steps when the order is already partway through the state machine", async () => {
    vi.mocked(squareClient.orders.get).mockResolvedValue(orderWithFulfillment("PREPARED") as any);
    vi.mocked(squareClient.orders.update).mockResolvedValue({} as any);

    await POST(makeContext({ orderId: "order-1" }));

    expect(squareClient.orders.update).toHaveBeenCalledTimes(1);
    const [arg]: any = vi.mocked(squareClient.orders.update).mock.calls[0];
    expect(arg.order.fulfillments[0].state).toBe("COMPLETED");
  });

  it("redirects with an update error when Square rejects the state transition", async () => {
    vi.mocked(squareClient.orders.get).mockResolvedValue(orderWithFulfillment("PROPOSED") as any);
    vi.mocked(squareClient.orders.update).mockRejectedValue(new Error("Square update failed"));

    const res = await POST(makeContext({ orderId: "order-1" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("error=update");
  });
});
