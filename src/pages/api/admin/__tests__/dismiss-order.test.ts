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

vi.mock("@/lib/admin/dismissedOrders", () => ({
  dismissOrder: vi.fn(),
}));

import { POST } from "../dismiss-order";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { dismissOrder } from "@/lib/admin/dismissedOrders";

const URL_BASE = "https://example.com/api/admin/dismiss-order";

type Context = Parameters<typeof POST>[0];

function makeContext(fields: Record<string, string>): Context {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  const request = new Request(URL_BASE, { method: "POST", body: formData });
  return {
    request,
    cookies: {},
    redirect: (url: string) =>
      new Response(null, { status: 302, headers: { Location: url } }),
  } as unknown as Context;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAdminAuthenticated).mockReturnValue(true);
});

describe("POST /api/admin/dismiss-order", () => {
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

  it("calls dismissOrder and redirects with dismissed=1 on success", async () => {
    vi.mocked(dismissOrder).mockResolvedValue(undefined);
    const res = await POST(makeContext({ orderId: "order-1", from: "/admin/orders/pickups" }));
    expect(dismissOrder).toHaveBeenCalledWith("order-1");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("dismissed=1");
  });

  it("redirects to the provided from path when it starts with /admin/orders/", async () => {
    vi.mocked(dismissOrder).mockResolvedValue(undefined);
    const res = await POST(makeContext({ orderId: "order-1", from: "/admin/orders/shipping" }));
    expect(res.headers.get("Location")).toMatch(/^\/admin\/orders\/shipping/);
  });

  it("falls back to /admin/orders/pickups when the from path is not under /admin/orders/", async () => {
    vi.mocked(dismissOrder).mockResolvedValue(undefined);
    const res = await POST(makeContext({ orderId: "order-1", from: "https://evil.com" }));
    expect(res.headers.get("Location")).toMatch(/^\/admin\/orders\/pickups/);
  });
});
