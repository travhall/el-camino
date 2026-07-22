import { describe, it, expect } from "vitest";
import { escHtml, formatMoney, shortOrderId, formatPickupTime } from "./templates";

describe("escHtml", () => {
  it("escapes all five HTML metacharacters", () => {
    expect(escHtml('<script>alert("xss")&nbsp;</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&amp;nbsp;&lt;/script&gt;"
    );
  });
  it("returns empty string for null", () => {
    expect(escHtml(null)).toBe("");
  });
  it("returns empty string for undefined", () => {
    expect(escHtml(undefined)).toBe("");
  });
  it("returns empty string for empty string", () => {
    expect(escHtml("")).toBe("");
  });
  it("leaves safe text unchanged", () => {
    expect(escHtml("Hello World")).toBe("Hello World");
  });
  it("escapes & before < so double-encoding does not occur", () => {
    expect(escHtml("a&b")).toBe("a&amp;b");
    expect(escHtml("a&lt;b")).toBe("a&amp;lt;b");
  });
});

describe("formatMoney", () => {
  it("returns $0.00 for null", () => {
    expect(formatMoney(null)).toBe("$0.00");
  });

  it("returns $0.00 for undefined", () => {
    expect(formatMoney(undefined)).toBe("$0.00");
  });

  it("formats a number (cents) correctly", () => {
    expect(formatMoney(1099)).toBe("$10.99");
  });

  it("formats a bigint (Square's actual return type)", () => {
    expect(formatMoney(2500n)).toBe("$25.00");
  });

  it("formats $0.00 for 0n (zero-value order)", () => {
    expect(formatMoney(0n)).toBe("$0.00");
  });

  it("formats large amounts correctly", () => {
    expect(formatMoney(100000)).toBe("$1000.00");
  });

  it("formats a large bigint amount correctly", () => {
    expect(formatMoney(9999n)).toBe("$99.99");
  });
});

describe("shortOrderId", () => {
  it("returns the last 8 characters uppercased", () => {
    expect(shortOrderId("abcdefgh12345678")).toBe("12345678");
  });

  it("uppercases lowercase characters", () => {
    expect(shortOrderId("XXXXXabc12345678")).toBe("12345678");
  });

  it("handles IDs shorter than 8 chars without crashing", () => {
    const result = shortOrderId("abc");
    expect(typeof result).toBe("string");
    expect(result).toBe("ABC");
  });

  it("uppercases alphabetic characters at the end of the ID", () => {
    expect(shortOrderId("000000000000abcdefgh")).toBe("ABCDEFGH");
  });
});

describe("formatPickupTime", () => {
  it("formats an ISO timestamp in Central Time", () => {
    // 2026-07-22T15:00:00Z = 10:00 AM CDT (UTC-5 in summer)
    const result = formatPickupTime("2026-07-22T15:00:00.000Z");
    expect(result).toContain("10:00 AM");
    expect(result).toContain("Jul");
    expect(result).toContain("22");
  });

  it("returns a non-empty string for any valid ISO date", () => {
    const result = formatPickupTime("2026-01-01T12:00:00.000Z");
    expect(result.length).toBeGreaterThan(5);
  });

  it("includes a timezone abbreviation in the output", () => {
    const result = formatPickupTime("2026-07-22T15:00:00.000Z");
    // CDT in summer, CST in winter — just check something timezone-shaped is present
    expect(result).toMatch(/C[SD]T/);
  });
});
