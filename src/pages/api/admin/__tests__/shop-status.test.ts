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

vi.mock("@/lib/shopStatus", () => ({
  getShopStatusConfig: vi.fn(),
  saveShopStatusConfig: vi.fn(),
}));

import { POST } from "../shop-status";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getShopStatusConfig, saveShopStatusConfig } from "@/lib/shopStatus";

const URL_BASE = "https://example.com/api/admin/shop-status";

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

const baseConfig = () => ({ mode: "auto" as const, until: undefined, holidays: [] });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAdminAuthenticated).mockReturnValue(true);
  vi.mocked(getShopStatusConfig).mockResolvedValue(baseConfig());
});

describe("POST /api/admin/shop-status", () => {
  it("redirects to login when not authenticated", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const res = await POST(makeContext({ action: "save-override", mode: "closed" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/admin/login");
  });

  it("returns 400 for an unknown action", async () => {
    const res = await POST(makeContext({ action: "bogus" }));
    expect(res.status).toBe(400);
  });

  describe("save-override", () => {
    it("rejects an invalid mode", async () => {
      const res = await POST(makeContext({ action: "save-override", mode: "sometimes" }));
      expect(res.status).toBe(400);
      expect(saveShopStatusConfig).not.toHaveBeenCalled();
    });

    it("saves mode and until, then redirects", async () => {
      const res = await POST(
        makeContext({ action: "save-override", mode: "closed", until: "2026-08-01" }),
      );
      expect(saveShopStatusConfig).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "closed", until: "2026-08-01" }),
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toContain("saved=override");
    });

    it("clears until when reverting to auto", async () => {
      vi.mocked(getShopStatusConfig).mockResolvedValue({
        mode: "closed",
        until: "2026-08-01",
        holidays: [],
      });
      await POST(makeContext({ action: "save-override", mode: "auto", until: "2026-09-01" }));
      expect(saveShopStatusConfig).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "auto", until: undefined }),
      );
    });
  });

  describe("add-holiday", () => {
    it("redirects with missing-label error when label is empty", async () => {
      const res = await POST(
        makeContext({ action: "add-holiday", label: "", type: "date", date: "2026-12-25" }),
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toContain("error=missing-label");
    });

    it("redirects with invalid-date error for a malformed one-time date", async () => {
      const res = await POST(
        makeContext({ action: "add-holiday", label: "Xmas", type: "date", date: "12/25/2026" }),
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toContain("error=invalid-date");
    });

    it("redirects with invalid-date error for a malformed recurring date", async () => {
      const res = await POST(
        makeContext({
          action: "add-holiday",
          label: "Xmas",
          type: "recurring",
          recurring: "December 25",
        }),
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toContain("error=invalid-date");
    });

    it("adds a valid one-time holiday and redirects", async () => {
      const res = await POST(
        makeContext({ action: "add-holiday", label: "Xmas", type: "date", date: "2026-12-25" }),
      );
      expect(saveShopStatusConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          holidays: [expect.objectContaining({ label: "Xmas", date: "2026-12-25" })],
        }),
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toContain("saved=holiday");
    });

    it("adds a valid recurring holiday", async () => {
      await POST(
        makeContext({
          action: "add-holiday",
          label: "Xmas",
          type: "recurring",
          recurring: "12-25",
        }),
      );
      expect(saveShopStatusConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          holidays: [expect.objectContaining({ label: "Xmas", recurring: "12-25" })],
        }),
      );
    });
  });

  describe("remove-holiday", () => {
    it("returns 400 when id is missing", async () => {
      const res = await POST(makeContext({ action: "remove-holiday" }));
      expect(res.status).toBe(400);
    });

    it("removes the matching holiday and redirects", async () => {
      vi.mocked(getShopStatusConfig).mockResolvedValue({
        mode: "auto",
        until: undefined,
        holidays: [
          { id: "keep", label: "New Year", date: "2027-01-01" },
          { id: "remove-me", label: "Xmas", date: "2026-12-25" },
        ],
      });

      const res = await POST(makeContext({ action: "remove-holiday", id: "remove-me" }));
      expect(saveShopStatusConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          holidays: [{ id: "keep", label: "New Year", date: "2027-01-01" }],
        }),
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toContain("removed=holiday");
    });
  });
});
