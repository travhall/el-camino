import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockIsAdmin } = vi.hoisted(() => ({ mockIsAdmin: vi.fn() }));

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/auth")>();
  return { ...actual, isAdminAuthenticated: mockIsAdmin };
});

vi.mock("@/lib/email/failedEmails", () => ({
  listFailedEmails: vi.fn().mockResolvedValue([]),
  getFailedEmail: vi.fn().mockResolvedValue(null),
  deleteFailedEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email/sender", () => ({
  sendOrderConfirmation: vi.fn().mockResolvedValue(undefined),
}));

import { GET, POST } from "../admin/retry-failed-emails";
import { listFailedEmails, getFailedEmail, deleteFailedEmail } from "@/lib/email/failedEmails";
import { sendOrderConfirmation } from "@/lib/email/sender";

function makeContext(opts: { method?: string; jsonBody?: unknown } = {}) {
  const { method = "GET", jsonBody } = opts;
  const request = {
    url: "https://example.com/api/admin/retry-failed-emails",
    method,
    headers: new Headers({ origin: "https://example.com" }),
    json: async () => jsonBody,
  } as unknown as Request;
  const cookies = { get: vi.fn(), set: vi.fn() };
  return { request, cookies } as any;
}

const FAKE_RECORD = {
  order: { id: "order-1", lineItems: [] },
  contact: { email: "test@example.com", name: "Test User", fulfillmentMethod: "pickup" },
};

describe("GET /api/admin/retry-failed-emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockReturnValue(true);
    (listFailedEmails as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    mockIsAdmin.mockReturnValue(false);
    const res = await GET(makeContext());
    expect(res.status).toBe(401);
  });

  it("returns 200 with list of failed emails", async () => {
    (listFailedEmails as ReturnType<typeof vi.fn>).mockResolvedValue([FAKE_RECORD]);
    const res = await GET(makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.failed).toHaveLength(1);
  });

  it("returns empty array when no failed emails", async () => {
    const res = await GET(makeContext());
    const body = await res.json();
    expect(body.failed).toEqual([]);
  });
});

describe("POST /api/admin/retry-failed-emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockReturnValue(true);
  });

  it("returns 401 when unauthenticated", async () => {
    mockIsAdmin.mockReturnValue(false);
    const res = await POST(makeContext({ method: "POST", jsonBody: { orderId: "order-1" } }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when orderId is missing", async () => {
    const res = await POST(makeContext({ method: "POST", jsonBody: {} }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when failed email record does not exist", async () => {
    const res = await POST(makeContext({ method: "POST", jsonBody: { orderId: "missing" } }));
    expect(res.status).toBe(404);
  });

  it("retries the email and deletes the record on success", async () => {
    (getFailedEmail as ReturnType<typeof vi.fn>).mockResolvedValue(FAKE_RECORD);
    const res = await POST(makeContext({ method: "POST", jsonBody: { orderId: "order-1" } }));
    expect(sendOrderConfirmation).toHaveBeenCalledWith({
      order: FAKE_RECORD.order,
      contact: FAKE_RECORD.contact,
    });
    expect(deleteFailedEmail).toHaveBeenCalledWith("order-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 500 when sendOrderConfirmation throws", async () => {
    (getFailedEmail as ReturnType<typeof vi.fn>).mockResolvedValue(FAKE_RECORD);
    (sendOrderConfirmation as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Resend error"));
    const res = await POST(makeContext({ method: "POST", jsonBody: { orderId: "order-1" } }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Resend error");
  });
});
