import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockIsAdmin } = vi.hoisted(() => ({ mockIsAdmin: vi.fn() }));

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/auth")>();
  return { ...actual, isAdminAuthenticated: mockIsAdmin };
});

vi.mock("@/lib/shopHours", () => ({
  DAYS_OF_WEEK: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
  saveShopHours: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../admin/hours";
import { saveShopHours } from "@/lib/shopHours";

function makeContext(formData?: Record<string, string>) {
  const request = {
    url: "https://example.com/api/admin/hours",
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

describe("POST /api/admin/hours", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockReturnValue(true);
  });

  it("redirects to login when unauthenticated", async () => {
    mockIsAdmin.mockReturnValue(false);
    const res = await POST(makeContext());
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/admin/login");
  });

  it("saves hours and redirects with saved=1 on success", async () => {
    const res = await POST(
      makeContext({
        isOpen_monday: "on",
        open_monday: "09:00",
        close_monday: "17:00",
      }),
    );
    expect(saveShopHours).toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("saved=1");
  });

  it("marks day as closed when isOpen checkbox is absent", async () => {
    await POST(makeContext({}));
    const entries = (saveShopHours as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const monday = entries.find((e: any) => e.day === "monday");
    expect(monday?.isOpen).toBe(false);
  });

  it("marks day as closed when time format is invalid", async () => {
    await POST(
      makeContext({ isOpen_tuesday: "on", open_tuesday: "9am", close_tuesday: "5pm" }),
    );
    const entries = (saveShopHours as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const tuesday = entries.find((e: any) => e.day === "tuesday");
    expect(tuesday?.isOpen).toBe(false);
  });
});
