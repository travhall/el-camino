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

vi.mock("@/lib/announcementBanner", () => ({
  saveAnnouncementBanner: vi.fn(),
  sanitizeLinkUrl: vi.fn((url: string) => url.trim()),
}));

import { POST } from "../banner";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { saveAnnouncementBanner } from "@/lib/announcementBanner";

const URL_BASE = "https://example.com/api/admin/banner";

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

describe("POST /api/admin/banner", () => {
  it("redirects to login when not authenticated", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const res = await POST(makeContext({ text: "Sale!" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/admin/login");
  });

  it("saves the banner and redirects with saved=1 on success", async () => {
    vi.mocked(saveAnnouncementBanner).mockResolvedValue(undefined);
    const res = await POST(makeContext({ text: "Big sale!", active: "on", expiresAt: "2026-12-31" }));
    expect(saveAnnouncementBanner).toHaveBeenCalledWith({
      text: "Big sale!",
      active: true,
      expiresAt: "2026-12-31",
      linkUrl: "",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("saved=1");
  });

  it("saves with active=false when the checkbox is absent", async () => {
    vi.mocked(saveAnnouncementBanner).mockResolvedValue(undefined);
    await POST(makeContext({ text: "Hello" }));
    expect(saveAnnouncementBanner).toHaveBeenCalledWith(
      expect.objectContaining({ active: false }),
    );
  });

  it("sets expiresAt to null when the date format is invalid", async () => {
    vi.mocked(saveAnnouncementBanner).mockResolvedValue(undefined);
    await POST(makeContext({ text: "Hello", active: "on", expiresAt: "not-a-date" }));
    expect(saveAnnouncementBanner).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: null }),
    );
  });

  it("sets expiresAt to null when the field is absent", async () => {
    vi.mocked(saveAnnouncementBanner).mockResolvedValue(undefined);
    await POST(makeContext({ text: "Hello" }));
    expect(saveAnnouncementBanner).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: null }),
    );
  });
});
