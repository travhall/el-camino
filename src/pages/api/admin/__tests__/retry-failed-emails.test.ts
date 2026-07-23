import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/admin/auth", () => ({
  isAdminAuthenticated: vi.fn().mockReturnValue(true),
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }),
}));

vi.mock("@/lib/email/failedEmails", () => ({
  listFailedEmails: vi.fn(),
  getFailedEmail: vi.fn(),
  deleteFailedEmail: vi.fn(),
}));

vi.mock("@/lib/email/sender", () => ({
  sendOrderConfirmation: vi.fn(),
}));

import { GET, POST } from "../retry-failed-emails";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { listFailedEmails, getFailedEmail, deleteFailedEmail } from "@/lib/email/failedEmails";
import { sendOrderConfirmation } from "@/lib/email/sender";

const URL_BASE = "https://example.com/api/admin/retry-failed-emails";

function makeContext(body?: object): any {
  const request = new Request(URL_BASE, {
    method: body ? "POST" : "GET",
    ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
  return { request, cookies: {} as any };
}

const record = {
  orderId: "order-1",
  order: { id: "order-1", lineItems: [] } as any,
  contact: { email: "customer@example.com", name: "Test", fulfillmentMethod: "pickup" as const },
  failedAt: "2026-07-22T00:00:00.000Z",
  error: "Resend failed",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAdminAuthenticated).mockReturnValue(true);
});

describe("GET /api/admin/retry-failed-emails", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const res = await GET(makeContext());
    expect(res.status).toBe(401);
  });

  it("returns the list of failed emails on success", async () => {
    vi.mocked(listFailedEmails).mockResolvedValue([record]);
    const res = await GET(makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, failed: [record] });
  });
});

describe("POST /api/admin/retry-failed-emails", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const res = await POST(makeContext({ orderId: "order-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when orderId is missing", async () => {
    const res = await POST(makeContext({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when no matching failed email record exists", async () => {
    vi.mocked(getFailedEmail).mockResolvedValue(null);
    const res = await POST(makeContext({ orderId: "unknown" }));
    expect(res.status).toBe(404);
  });

  it("resends the confirmation and deletes the failed record on success", async () => {
    vi.mocked(getFailedEmail).mockResolvedValue(record);
    vi.mocked(sendOrderConfirmation).mockResolvedValue(undefined as any);
    const res = await POST(makeContext({ orderId: "order-1" }));
    expect(res.status).toBe(200);
    expect(sendOrderConfirmation).toHaveBeenCalledWith({
      order: record.order,
      contact: record.contact,
    });
    expect(deleteFailedEmail).toHaveBeenCalledWith("order-1");
  });

  it("returns 500 and does not delete the record when resending fails again", async () => {
    vi.mocked(getFailedEmail).mockResolvedValue(record);
    vi.mocked(sendOrderConfirmation).mockRejectedValue(new Error("Resend down again"));
    const res = await POST(makeContext({ orderId: "order-1" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(deleteFailedEmail).not.toHaveBeenCalled();
  });
});
