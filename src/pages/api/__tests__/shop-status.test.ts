import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/shopStatus", () => ({
  getShopStatusConfig: vi.fn(),
}));

import { GET } from "../shop-status";
import { getShopStatusConfig } from "@/lib/shopStatus";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/shop-status (public)", () => {
  it("returns the current mode, until, and holidays from config", async () => {
    vi.mocked(getShopStatusConfig).mockResolvedValue({
      mode: "closed",
      until: "2026-08-01T00:00:00.000Z",
      holidays: [{ id: "1", label: "Fourth of July", date: "2026-07-04" }],
    });

    const res = await GET({} as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      mode: "closed",
      until: "2026-08-01T00:00:00.000Z",
      holidays: [{ id: "1", label: "Fourth of July", date: "2026-07-04" }],
    });
  });

  it("normalizes a missing until to null", async () => {
    vi.mocked(getShopStatusConfig).mockResolvedValue({
      mode: "auto",
      holidays: [],
    } as any);

    const res = await GET({} as any);
    const body = await res.json();
    expect(body.until).toBeNull();
  });

  it("fails open with mode 'auto' when the config read throws", async () => {
    vi.mocked(getShopStatusConfig).mockRejectedValue(new Error("blob store down"));

    const res = await GET({} as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ mode: "auto", until: null, holidays: [] });
  });
});
