import { describe, it, expect, vi, beforeEach } from "vitest";

const mockContact = { name: "El Camino" };
const mockSocial = [{ platform: "instagram", url: "https://x", icon: "uil:instagram" }];
const mockHours = [{ day: "Monday", isOpen: false, hours: "Closed" }];
const mockStructured = { "@type": "LocalBusiness" };

const getContactInfo = vi.fn().mockResolvedValue(mockContact);
const getSocialLinks = vi.fn().mockResolvedValue(mockSocial);
const getShopHours = vi.fn().mockResolvedValue(mockHours);
const getStructuredData = vi.fn().mockResolvedValue(mockStructured);
const getSalePageVisible = vi.fn().mockResolvedValue(true);
const getShopPageVisible = vi.fn().mockResolvedValue(true);

vi.mock("@/lib/contactInfo", () => ({ getContactInfo: (...a: unknown[]) => getContactInfo(...a) }));
vi.mock("@/lib/socialLinks", () => ({ getSocialLinks: (...a: unknown[]) => getSocialLinks(...a) }));
vi.mock("@/lib/shopHours", () => ({ getShopHours: (...a: unknown[]) => getShopHours(...a) }));
vi.mock("@/lib/structuredData", () => ({ getStructuredData: (...a: unknown[]) => getStructuredData(...a) }));
vi.mock("@/lib/saleVisibility", () => ({ getSalePageVisible: (...a: unknown[]) => getSalePageVisible(...a) }));
vi.mock("@/lib/shopVisibility", () => ({ getShopPageVisible: (...a: unknown[]) => getShopPageVisible(...a) }));

import { getSiteContext } from "../siteContext";

describe("getSiteContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getContactInfo.mockResolvedValue(mockContact);
    getSocialLinks.mockResolvedValue(mockSocial);
    getShopHours.mockResolvedValue(mockHours);
    getStructuredData.mockResolvedValue(mockStructured);
    getSalePageVisible.mockResolvedValue(true);
    getShopPageVisible.mockResolvedValue(true);
  });

  it("calls each underlying getter exactly once per request and passes resolved values into getStructuredData", async () => {
    const locals = {} as App.Locals;
    const ctx = await getSiteContext(locals);

    expect(getContactInfo).toHaveBeenCalledTimes(1);
    expect(getSocialLinks).toHaveBeenCalledTimes(1);
    expect(getShopHours).toHaveBeenCalledTimes(1);
    expect(getSalePageVisible).toHaveBeenCalledTimes(1);
    expect(getShopPageVisible).toHaveBeenCalledTimes(1);
    expect(getStructuredData).toHaveBeenCalledTimes(1);
    expect(getStructuredData).toHaveBeenCalledWith(mockContact, mockSocial, mockHours);

    expect(ctx).toEqual({
      contact: mockContact,
      social: mockSocial,
      hours: mockHours,
      structured: mockStructured,
      salePageVisible: true,
      shopPageVisible: true,
    });
  });

  it("memoizes on locals — a second call in the same request does not refetch", async () => {
    const locals = {} as App.Locals;
    await getSiteContext(locals);
    await getSiteContext(locals);

    expect(getContactInfo).toHaveBeenCalledTimes(1);
    expect(getStructuredData).toHaveBeenCalledTimes(1);
  });

  it("shares in-flight work across concurrent callers in the same request", async () => {
    const locals = {} as App.Locals;
    const [a, b] = await Promise.all([getSiteContext(locals), getSiteContext(locals)]);

    expect(a).toBe(b);
    expect(getContactInfo).toHaveBeenCalledTimes(1);
  });
});
