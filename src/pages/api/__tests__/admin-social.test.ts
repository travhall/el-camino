import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockIsAdmin } = vi.hoisted(() => ({ mockIsAdmin: vi.fn() }));

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/auth")>();
  return { ...actual, isAdminAuthenticated: mockIsAdmin };
});

vi.mock("@/lib/socialLinks", () => ({
  getSocialLinks: vi.fn().mockResolvedValue([]),
  saveSocialLinks: vi.fn().mockResolvedValue(undefined),
  KNOWN_PLATFORMS: { instagram: "uil:instagram", facebook: "uil:facebook" },
}));

import { POST } from "../admin/social";
import { getSocialLinks, saveSocialLinks } from "@/lib/socialLinks";

function makeContext(formData?: Record<string, string>) {
  const request = {
    url: "https://example.com/api/admin/social",
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

describe("POST /api/admin/social", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockReturnValue(true);
    (getSocialLinks as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("redirects to login when unauthenticated", async () => {
    mockIsAdmin.mockReturnValue(false);
    const res = await POST(makeContext());
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/admin/login");
  });

  it("returns 400 for unknown action", async () => {
    const res = await POST(makeContext({ action: "unknown" }));
    expect(res.status).toBe(400);
  });

  describe("action=add", () => {
    it("saves new link and redirects with saved=1", async () => {
      const res = await POST(
        makeContext({ action: "add", platform: "instagram", url: "https://instagram.com/shop" }),
      );
      expect(saveSocialLinks).toHaveBeenCalled();
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toContain("saved=1");
    });

    it("redirects with error=missing-fields when platform or url is absent", async () => {
      const res = await POST(makeContext({ action: "add", platform: "instagram" }));
      expect(res.headers.get("Location")).toContain("error=missing-fields");
    });

    it("redirects with error=invalid-url for non-http schemes", async () => {
      const res = await POST(
        makeContext({ action: "add", platform: "instagram", url: "javascript:alert(1)" }),
      );
      expect(res.headers.get("Location")).toContain("error=invalid-url");
    });

    it("redirects with error=duplicate when platform already exists", async () => {
      (getSocialLinks as ReturnType<typeof vi.fn>).mockResolvedValue([
        { platform: "instagram", url: "https://instagram.com/existing", icon: "uil:instagram" },
      ]);
      const res = await POST(
        makeContext({ action: "add", platform: "instagram", url: "https://instagram.com/new" }),
      );
      expect(res.headers.get("Location")).toContain("error=duplicate");
    });
  });

  describe("action=remove", () => {
    it("removes the matching platform and redirects with saved=1", async () => {
      (getSocialLinks as ReturnType<typeof vi.fn>).mockResolvedValue([
        { platform: "instagram", url: "https://instagram.com/shop", icon: "uil:instagram" },
        { platform: "facebook", url: "https://facebook.com/shop", icon: "uil:facebook" },
      ]);
      const res = await POST(makeContext({ action: "remove", platform: "instagram" }));
      expect(saveSocialLinks).toHaveBeenCalledWith([
        expect.objectContaining({ platform: "facebook" }),
      ]);
      expect(res.headers.get("Location")).toContain("saved=1");
    });
  });

  describe("action=update-url", () => {
    it("updates the URL for the given platform and redirects with saved=1", async () => {
      (getSocialLinks as ReturnType<typeof vi.fn>).mockResolvedValue([
        { platform: "instagram", url: "https://instagram.com/old", icon: "uil:instagram" },
      ]);
      const res = await POST(
        makeContext({
          action: "update-url",
          platform: "instagram",
          url: "https://instagram.com/new",
        }),
      );
      expect(saveSocialLinks).toHaveBeenCalledWith([
        expect.objectContaining({ url: "https://instagram.com/new" }),
      ]);
      expect(res.headers.get("Location")).toContain("saved=1");
    });

    it("redirects with error=invalid-url for non-http schemes", async () => {
      const res = await POST(
        makeContext({ action: "update-url", platform: "instagram", url: "ftp://bad.example" }),
      );
      expect(res.headers.get("Location")).toContain("error=invalid-url");
    });
  });
});
