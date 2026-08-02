import { describe, it, expect } from "vitest";
import {
  sanitizeLinkUrl,
  resolveAnnouncementBanner,
  type AnnouncementBanner,
} from "@/lib/announcementBanner";

describe("sanitizeLinkUrl", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeLinkUrl("")).toBe("");
    expect(sanitizeLinkUrl("   ")).toBe("");
  });

  it("accepts root-relative paths", () => {
    expect(sanitizeLinkUrl("/sale")).toBe("/sale");
    expect(sanitizeLinkUrl("/shop/bikes/road")).toBe("/shop/bikes/road");
  });

  it("accepts https:// URLs", () => {
    expect(sanitizeLinkUrl("https://example.com")).toBe("https://example.com");
    expect(sanitizeLinkUrl("https://example.com/path?q=1")).toBe(
      "https://example.com/path?q=1",
    );
  });

  it("rejects javascript: URIs", () => {
    expect(sanitizeLinkUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeLinkUrl("javascript:void(0)")).toBe("");
  });

  it("rejects data: URIs", () => {
    expect(sanitizeLinkUrl("data:text/html,<h1>x</h1>")).toBe("");
    expect(sanitizeLinkUrl("data:image/png;base64,abc")).toBe("");
  });

  it("rejects http:// URLs", () => {
    expect(sanitizeLinkUrl("http://example.com")).toBe("");
  });

  it("rejects protocol-relative URLs (//)", () => {
    expect(sanitizeLinkUrl("//example.com")).toBe("");
  });

  it("rejects arbitrary non-URL strings", () => {
    expect(sanitizeLinkUrl("not a url")).toBe("");
  });

  it("trims whitespace before validating", () => {
    expect(sanitizeLinkUrl("  /sale  ")).toBe("/sale");
    expect(sanitizeLinkUrl("  https://example.com  ")).toBe(
      "https://example.com",
    );
  });
});

describe("resolveAnnouncementBanner", () => {
  const base: AnnouncementBanner = {
    text: "Hello",
    active: true,
    expiresAt: null,
  };

  it("returns text when active and no expiry", () => {
    expect(resolveAnnouncementBanner(base, "2026-01-01")).toBe("Hello");
  });

  it("returns null when inactive", () => {
    expect(
      resolveAnnouncementBanner({ ...base, active: false }, "2026-01-01"),
    ).toBeNull();
  });

  it("returns null when text is empty", () => {
    expect(
      resolveAnnouncementBanner({ ...base, text: "  " }, "2026-01-01"),
    ).toBeNull();
  });

  it("returns null on or after expiresAt", () => {
    const banner = { ...base, expiresAt: "2026-06-01" };
    expect(resolveAnnouncementBanner(banner, "2026-06-01")).toBeNull();
    expect(resolveAnnouncementBanner(banner, "2026-06-02")).toBeNull();
  });

  it("returns text before expiresAt", () => {
    const banner = { ...base, expiresAt: "2026-06-01" };
    expect(resolveAnnouncementBanner(banner, "2026-05-31")).toBe("Hello");
  });
});
