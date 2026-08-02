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

vi.mock("@/lib/backInStock", () => ({
  getSubscriptionsForProduct: vi.fn(),
  removeSubscription: vi.fn(),
}));

vi.mock("@/lib/email/sender", () => ({
  sendBackInStockNotification: vi.fn(),
}));

import { POST } from "../send-back-in-stock";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getSubscriptionsForProduct, removeSubscription } from "@/lib/backInStock";
import { sendBackInStockNotification } from "@/lib/email/sender";

const URL_BASE = "https://example.com/api/admin/send-back-in-stock";

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

const subscribers = [
  { productId: "prod-1", email: "a@example.com", productTitle: "Deck", productUrl: "/products/deck" },
  { productId: "prod-1", email: "b@example.com", productTitle: "Deck", productUrl: "/products/deck" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAdminAuthenticated).mockReturnValue(true);
});

describe("POST /api/admin/send-back-in-stock", () => {
  it("redirects to login when not authenticated", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const res = await POST(makeContext({ productId: "prod-1" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/admin/login");
  });

  it("returns 400 when productId is missing", async () => {
    const res = await POST(makeContext({}));
    expect(res.status).toBe(400);
  });

  it("redirects with error=none when there are no subscribers", async () => {
    vi.mocked(getSubscriptionsForProduct).mockResolvedValue([]);
    const res = await POST(makeContext({ productId: "prod-1" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("error=none");
  });

  it("sends emails, removes subscriptions, and redirects with sent count", async () => {
    vi.mocked(getSubscriptionsForProduct).mockResolvedValue(subscribers as any);
    vi.mocked(sendBackInStockNotification).mockResolvedValue(undefined as any);
    vi.mocked(removeSubscription).mockResolvedValue(undefined);

    const res = await POST(makeContext({ productId: "prod-1" }));
    expect(sendBackInStockNotification).toHaveBeenCalledTimes(2);
    expect(removeSubscription).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("sent=2");
  });

  it("counts failed sends separately and includes failed param in redirect", async () => {
    vi.mocked(getSubscriptionsForProduct).mockResolvedValue(subscribers as any);
    vi.mocked(sendBackInStockNotification)
      .mockResolvedValueOnce(undefined as any)
      .mockRejectedValueOnce(new Error("Resend error"));
    vi.mocked(removeSubscription).mockResolvedValue(undefined);

    const res = await POST(makeContext({ productId: "prod-1" }));
    const loc = res.headers.get("Location") ?? "";
    expect(loc).toContain("sent=1");
    expect(loc).toContain("failed=1");
  });
});
