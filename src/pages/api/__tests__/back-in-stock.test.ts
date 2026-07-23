import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCheck } = vi.hoisted(() => ({
  mockCheck: vi.fn().mockReturnValue(false),
}));
vi.mock("@/lib/rateLimit", () => ({
  createRateLimiter: () => ({ check: mockCheck }),
  clientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/backInStock", () => ({
  addSubscription: vi.fn().mockResolvedValue(undefined),
  isAlreadySubscribed: vi.fn().mockResolvedValue(false),
  getSubscriptionsForProduct: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/email/sender", () => ({
  sendBisAdminNotification: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../back-in-stock";
import {
  addSubscription,
  isAlreadySubscribed,
  getSubscriptionsForProduct,
} from "@/lib/backInStock";
import { sendBisAdminNotification } from "@/lib/email/sender";

const BIS_URL = "https://example.com/api/back-in-stock";

function makeRequest(fields: Record<string, string>): Request {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return new Request(BIS_URL, { method: "POST", body: formData });
}

function makeContext(fields: Record<string, string>): any {
  return { request: makeRequest(fields) };
}

const validFields = {
  email: "customer@example.com",
  product_title: "Baker Deck",
  product_id: "PROD123",
  variation_id: "VAR123",
  product_url: "https://example.com/product/baker-deck",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCheck.mockReturnValue(false);
  vi.mocked(isAlreadySubscribed).mockResolvedValue(false);
  vi.mocked(getSubscriptionsForProduct).mockResolvedValue([]);
});

describe("POST /api/back-in-stock", () => {
  it("returns 429 when the rate limiter rejects the request", async () => {
    mockCheck.mockReturnValue(true);
    const res = await POST(makeContext(validFields));
    expect(res.status).toBe(429);
  });

  it("returns 400 for a missing email", async () => {
    const res = await POST(makeContext({ ...validFields, email: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it("returns 400 for an invalid email format", async () => {
    const res = await POST(makeContext({ ...validFields, email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a missing product ID", async () => {
    const res = await POST(makeContext({ ...validFields, product_id: "" }));
    expect(res.status).toBe(400);
  });

  it("stores a new subscription and returns 200 on valid input", async () => {
    const res = await POST(makeContext(validFields));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(addSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ email: "customer@example.com", productId: "PROD123" }),
    );
  });

  it("notifies the admin of the new subscription", async () => {
    vi.mocked(getSubscriptionsForProduct).mockResolvedValue([{} as any, {} as any]);
    await POST(makeContext(validFields));
    expect(sendBisAdminNotification).toHaveBeenCalledWith(
      expect.objectContaining({ subscriberEmail: "customer@example.com", totalSubscribers: 2 }),
    );
  });

  it("is idempotent for an already-subscribed email: returns 200 but does not store or notify again", async () => {
    vi.mocked(isAlreadySubscribed).mockResolvedValue(true);
    const res = await POST(makeContext(validFields));
    expect(res.status).toBe(200);
    expect(addSubscription).not.toHaveBeenCalled();
    expect(sendBisAdminNotification).not.toHaveBeenCalled();
  });

  it("returns 500 when an unexpected error occurs", async () => {
    vi.mocked(isAlreadySubscribed).mockRejectedValue(new Error("blob store down"));
    const res = await POST(makeContext(validFields));
    expect(res.status).toBe(500);
  });
});
