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

vi.mock("@/lib/contactInfo", () => ({
  saveContactInfo: vi.fn(),
}));

import { POST } from "../contact";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { saveContactInfo } from "@/lib/contactInfo";

const URL_BASE = "https://example.com/api/admin/contact";

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

const validFields = {
  name: "El Camino Shop",
  street: "123 Main St",
  city: "Austin",
  state: "TX",
  zip: "78701",
  phone: "(512) 555-1234",
  email: "shop@example.com",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAdminAuthenticated).mockReturnValue(true);
});

describe("POST /api/admin/contact", () => {
  it("redirects to login when not authenticated", async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const res = await POST(makeContext(validFields));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/admin/login");
  });

  it("saves contact info and redirects with saved=1 on success", async () => {
    vi.mocked(saveContactInfo).mockResolvedValue(undefined);
    const res = await POST(makeContext(validFields));
    expect(saveContactInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "El Camino Shop",
        street: "123 Main St",
        city: "Austin",
        state: "TX",
        zip: "78701",
        email: "shop@example.com",
      }),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("saved=1");
  });

  it("strips non-digits from phone and prepends + for phoneRaw", async () => {
    vi.mocked(saveContactInfo).mockResolvedValue(undefined);
    await POST(makeContext({ ...validFields, phone: "(512) 555-1234" }));
    expect(saveContactInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "(512) 555-1234",
        phoneRaw: "+5125551234",
      }),
    );
  });

  it("sets phoneRaw to empty string when phone has no digits", async () => {
    vi.mocked(saveContactInfo).mockResolvedValue(undefined);
    await POST(makeContext({ ...validFields, phone: "" }));
    expect(saveContactInfo).toHaveBeenCalledWith(
      expect.objectContaining({ phoneRaw: "" }),
    );
  });
});
