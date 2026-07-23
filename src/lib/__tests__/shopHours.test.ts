import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock @netlify/blobs — same pattern as src/lib/cache/__tests__/blobCache.test.ts
const mockBlobStore = {
  get: vi.fn(),
  setJSON: vi.fn(),
};

vi.mock("@netlify/blobs", () => ({
  getStore: vi.fn(() => mockBlobStore),
}));

import {
  formatTime,
  toDisplayHours,
  getShopHoursRaw,
  getShopHours,
  saveShopHours,
  formatHoursForEmail,
  DAYS_OF_WEEK,
  type ShopHoursEntry,
} from "../shopHours";

const closedWeek = (): ShopHoursEntry[] =>
  DAYS_OF_WEEK.map((day) => ({ day, isOpen: false, open: "", close: "" }));

describe("formatTime", () => {
  it("formats an on-the-hour morning time", () => {
    expect(formatTime("11:00")).toBe("11am");
  });

  it("formats an on-the-hour evening time using 12-hour clock", () => {
    expect(formatTime("19:00")).toBe("7pm");
  });

  it("includes minutes for a non-hour time", () => {
    expect(formatTime("13:30")).toBe("1:30pm");
  });

  it("formats midnight and noon correctly", () => {
    expect(formatTime("00:00")).toBe("12am");
    expect(formatTime("12:00")).toBe("12pm");
  });

  it("returns an empty string for an empty input", () => {
    expect(formatTime("")).toBe("");
  });
});

describe("toDisplayHours", () => {
  it("formats an open/close pair as a range", () => {
    expect(toDisplayHours("11:00", "19:00")).toBe("11am - 7pm");
  });

  it("returns 'Closed' when either time is missing", () => {
    expect(toDisplayHours("", "19:00")).toBe("Closed");
    expect(toDisplayHours("11:00", "")).toBe("Closed");
  });
});

describe("getShopHoursRaw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the stored schedule when present and well-formed", async () => {
    const stored = closedWeek();
    stored[2] = { day: "Wednesday", isOpen: true, open: "11:00", close: "19:00" };
    mockBlobStore.get.mockResolvedValue(stored);

    const result = await getShopHoursRaw();
    expect(result).toEqual(stored);
  });

  it("falls back to siteConfig hours when the blob store has no data", async () => {
    mockBlobStore.get.mockResolvedValue(null);
    const result = await getShopHoursRaw();
    expect(result).toHaveLength(7);
    // From src/lib/site-config.ts: Wednesday is open 11am - 7pm
    const wednesday = result.find((e) => e.day === "Wednesday");
    expect(wednesday).toEqual({ day: "Wednesday", isOpen: true, open: "11:00", close: "19:00" });
  });

  it("falls back to siteConfig hours when the stored data is malformed (wrong length)", async () => {
    mockBlobStore.get.mockResolvedValue([{ day: "Monday", isOpen: false, open: "", close: "" }]);
    const result = await getShopHoursRaw();
    expect(result).toHaveLength(7);
  });

  it("falls back to siteConfig hours when the blob read throws", async () => {
    mockBlobStore.get.mockRejectedValue(new Error("blob unavailable"));
    const result = await getShopHoursRaw();
    expect(result).toHaveLength(7);
  });
});

describe("getShopHours", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("converts raw entries to display format", async () => {
    const raw = closedWeek();
    raw[2] = { day: "Wednesday", isOpen: true, open: "11:00", close: "19:00" };
    mockBlobStore.get.mockResolvedValue(raw);

    const result = await getShopHours();
    const wednesday = result.find((e) => e.day === "Wednesday");
    expect(wednesday).toEqual({ day: "Wednesday", isOpen: true, hours: "11am - 7pm" });
    const monday = result.find((e) => e.day === "Monday");
    expect(monday).toEqual({ day: "Monday", isOpen: false, hours: "Closed" });
  });
});

describe("saveShopHours", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes the entries to the blob store under the shop-hours key", async () => {
    const entries = closedWeek();
    await saveShopHours(entries);
    expect(mockBlobStore.setJSON).toHaveBeenCalledWith("shop-hours", entries);
  });
});

describe("formatHoursForEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a fallback message when the store is closed every day", async () => {
    mockBlobStore.get.mockResolvedValue(closedWeek());
    expect(await formatHoursForEmail()).toBe("See website for hours");
  });

  it("groups consecutive days with identical hours into a range", async () => {
    const raw = closedWeek();
    for (const day of ["Wednesday", "Thursday", "Friday", "Saturday"]) {
      raw.find((e) => e.day === day)!.isOpen = true;
      raw.find((e) => e.day === day)!.open = "11:00";
      raw.find((e) => e.day === day)!.close = "19:00";
    }
    raw.find((e) => e.day === "Sunday")!.isOpen = true;
    raw.find((e) => e.day === "Sunday")!.open = "11:00";
    raw.find((e) => e.day === "Sunday")!.close = "17:00";
    mockBlobStore.get.mockResolvedValue(raw);

    expect(await formatHoursForEmail()).toBe("Wed–Sat 11am–7pm · Sun 11am–5pm");
  });

  it("groups by adjacency in the open-days list, not by calendar gap — days with closed days between them still merge if they're the only open days with matching hours", async () => {
    // Grouping filters to open days first, then merges consecutive entries in
    // that filtered list — it does not consider the closed days (Tue-Thu) as
    // breaking the run between Monday and Friday.
    const raw = closedWeek();
    raw.find((e) => e.day === "Monday")!.isOpen = true;
    raw.find((e) => e.day === "Monday")!.open = "11:00";
    raw.find((e) => e.day === "Monday")!.close = "19:00";
    raw.find((e) => e.day === "Friday")!.isOpen = true;
    raw.find((e) => e.day === "Friday")!.open = "11:00";
    raw.find((e) => e.day === "Friday")!.close = "19:00";
    mockBlobStore.get.mockResolvedValue(raw);

    expect(await formatHoursForEmail()).toBe("Mon–Fri 11am–7pm");
  });

  it("keeps two open groups separate when their hours differ", async () => {
    const raw = closedWeek();
    raw.find((e) => e.day === "Monday")!.isOpen = true;
    raw.find((e) => e.day === "Monday")!.open = "11:00";
    raw.find((e) => e.day === "Monday")!.close = "19:00";
    raw.find((e) => e.day === "Friday")!.isOpen = true;
    raw.find((e) => e.day === "Friday")!.open = "10:00";
    raw.find((e) => e.day === "Friday")!.close = "18:00";
    mockBlobStore.get.mockResolvedValue(raw);

    expect(await formatHoursForEmail()).toBe("Mon 11am–7pm · Fri 10am–6pm");
  });
});
