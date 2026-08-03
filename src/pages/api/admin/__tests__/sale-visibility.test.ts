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

vi.mock("@/lib/saleVisibility", () => ({
  setSalePageVisible: vi.fn(),
}));

import { POST } from "../sale-visibility";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { setSalePageVisible } from "@/lib/saleVisibility";

const URL_BASE = "https://example.com/api/admin/sale-visibility";

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

describe("POST /api/admin/sale-visibility", () => {
  it("redirects to login when not authenticated", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const res = await POST(makeContext({}));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/admin/login");
  });

  it("sets sale page visible=true when checkbox is on and redirects with saved=1", async () => {
    vi.mocked(setSalePageVisible).mockResolvedValue(undefined);
    const res = await POST(makeContext({ salePageVisible: "on" }));
    expect(setSalePageVisible).toHaveBeenCalledWith(true);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("saved=1");
  });

  it("sets sale page visible=false when checkbox is absent", async () => {
    vi.mocked(setSalePageVisible).mockResolvedValue(undefined);
    await POST(makeContext({}));
    expect(setSalePageVisible).toHaveBeenCalledWith(false);
  });
});
