import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockIsAdmin } = vi.hoisted(() => ({ mockIsAdmin: vi.fn() }));

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/auth")>();
  return { ...actual, isAdminAuthenticated: mockIsAdmin };
});

vi.mock("@/lib/backInStock", () => ({
  getSubscriptionsForProduct: vi.fn().mockResolvedValue([]),
  removeSubscription: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email/sender", () => ({
  sendBackInStockNotification: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../admin/send-back-in-stock";
import { getSubscriptionsForProduct, removeSubscription } from "@/lib/backInStock";
import { sendBackInStockNotification } from "@/lib/email/sender";

function makeContext(formData?: Record<string, string>) {
  const request = {
    url: "https://example.com/api/admin/send-back-in-stock",
    method: "POST",
    headers: new Headers({ origin: "https://example.com" }),
    formData: async () => {
      const fd = new FormData();
      if (formData) for (const [k, v] of Object.entries(formData)) fd.append(k, v);
      return fd;
    },
  } as unknown as Request;
  const redirect = (location: string) =>
    new Response(null, { status: 302, headers: { Location: location } });
  const cookies = { get: vi.fn(), set: vi.fn() };
  return { request, cookies, redirect } as any;
}

const SUBSCRIBERS = [
  { email: "a@example.com", productTitle: "Baker Deck", productUrl: "/products/baker", productId: "prod-1" },
  { email: "b@example.com", productTitle: "Baker Deck", productUrl: "/products/baker", productId: "prod-1" },
];

describe("POST /api/admin/send-back-in-stock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockReturnValue(true);
    (getSubscriptionsForProduct as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (sendBackInStockNotification as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (removeSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it("redirects to login when unauthenticated", async () => {
    mockIsAdmin.mockReturnValue(false);
    const res = await POST(makeContext({ productId: "prod-1" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/admin/login");
  });

  it("returns 400 when productId is missing", async () => {
    const res = await POST(makeContext({}));
    expect(res.status).toBe(400);
  });

  it("redirects with error=none when no subscribers exist", async () => {
    const res = await POST(makeContext({ productId: "prod-1" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("error=none");
  });

  it("sends notification to each subscriber and removes them", async () => {
    (getSubscriptionsForProduct as ReturnType<typeof vi.fn>).mockResolvedValue(SUBSCRIBERS);
    const res = await POST(makeContext({ productId: "prod-1" }));
    expect(sendBackInStockNotification).toHaveBeenCalledTimes(2);
    expect(removeSubscription).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(302);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("sent=2");
  });

  it("continues sending to remaining subscribers when one fails and reports failed count", async () => {
    (getSubscriptionsForProduct as ReturnType<typeof vi.fn>).mockResolvedValue(SUBSCRIBERS);
    (sendBackInStockNotification as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("Resend error"))
      .mockResolvedValueOnce(undefined);

    const res = await POST(makeContext({ productId: "prod-1" }));
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("sent=1");
    expect(location).toContain("failed=1");
  });
});
