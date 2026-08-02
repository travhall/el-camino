import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockIsAdmin } = vi.hoisted(() => ({ mockIsAdmin: vi.fn() }));

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/auth")>();
  return { ...actual, isAdminAuthenticated: mockIsAdmin };
});

vi.mock("@/lib/shopVisibility", () => ({
  setShopPageVisible: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../admin/shop-visibility";
import { setShopPageVisible } from "@/lib/shopVisibility";

function makeContext(formData?: Record<string, string>) {
  const request = {
    url: "https://example.com/api/admin/shop-visibility",
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

describe("POST /api/admin/shop-visibility", () => {
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

  it("sets visible=true when checkbox is on and redirects with saved=1", async () => {
    const res = await POST(makeContext({ shopPageVisible: "on" }));
    expect(setShopPageVisible).toHaveBeenCalledWith(true);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("saved=1");
  });

  it("sets visible=false when checkbox is absent", async () => {
    await POST(makeContext({}));
    expect(setShopPageVisible).toHaveBeenCalledWith(false);
  });
});
