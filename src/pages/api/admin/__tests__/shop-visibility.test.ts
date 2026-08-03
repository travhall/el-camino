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

vi.mock("@/lib/shopVisibility", () => ({
  setShopPageVisible: vi.fn(),
}));

import { POST } from "../shop-visibility";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { setShopPageVisible } from "@/lib/shopVisibility";

const URL_BASE = "https://example.com/api/admin/shop-visibility";

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

describe("POST /api/admin/shop-visibility", () => {
  it("redirects to login when not authenticated", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const res = await POST(makeContext({}));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/admin/login");
  });

  it("sets shop page visible=true when checkbox is on and redirects with saved=1", async () => {
    vi.mocked(setShopPageVisible).mockResolvedValue(undefined);
    const res = await POST(makeContext({ shopPageVisible: "on" }));
    expect(setShopPageVisible).toHaveBeenCalledWith(true);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("saved=1");
  });

  it("sets shop page visible=false when checkbox is absent", async () => {
    vi.mocked(setShopPageVisible).mockResolvedValue(undefined);
    await POST(makeContext({}));
    expect(setShopPageVisible).toHaveBeenCalledWith(false);
  });
});
