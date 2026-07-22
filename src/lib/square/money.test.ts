import { describe, it, expect } from "vitest";
import { MoneyUtils } from "./money";

describe("MoneyUtils.format", () => {
  it("returns $0.00 for null amount", () => {
    expect(MoneyUtils.format({ amount: null as unknown as number, currency: "USD" })).toBe("$0.00");
  });

  it("returns $0.00 for undefined amount", () => {
    expect(MoneyUtils.format({ amount: undefined as unknown as number, currency: "USD" })).toBe("$0.00");
  });

  it("returns $0.00 for amount of 0", () => {
    expect(MoneyUtils.format({ amount: 0, currency: "USD" })).toBe("$0.00");
  });

  it("returns $0.00 for bigint zero", () => {
    expect(MoneyUtils.format({ amount: 0n as unknown as number, currency: "USD" })).toBe("$0.00");
  });

  it("formats a number amount in cents to USD", () => {
    expect(MoneyUtils.format({ amount: 1099, currency: "USD" })).toBe("$10.99");
  });

  it("formats a bigint amount in cents to USD", () => {
    expect(MoneyUtils.format({ amount: 2500n as unknown as number, currency: "USD" })).toBe("$25.00");
  });

  it("formats a string amount in cents to USD", () => {
    expect(MoneyUtils.format({ amount: "599" as unknown as number, currency: "USD" })).toBe("$5.99");
  });

  it("defaults currency to USD when currency is absent", () => {
    expect(MoneyUtils.format({ amount: 100 } as { amount: number })).toBe("$1.00");
  });

  it("respects a non-USD currency code", () => {
    const result = MoneyUtils.format({ amount: 1000, currency: "EUR" });
    expect(result).toContain("10");
    expect(result).toContain("€");
  });

  it("formats large amounts with comma separator", () => {
    expect(MoneyUtils.format({ amount: 100000, currency: "USD" })).toBe("$1,000.00");
  });
});

describe("MoneyUtils.fromFloat", () => {
  it("converts a float dollar amount to cents with USD default", () => {
    expect(MoneyUtils.fromFloat(10.99)).toEqual({ amount: 1099, currency: "USD" });
  });

  it("rounds floating-point imprecision correctly", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS — must round to 30 cents
    expect(MoneyUtils.fromFloat(0.1 + 0.2)).toEqual({ amount: 30, currency: "USD" });
  });

  it("accepts a custom currency", () => {
    expect(MoneyUtils.fromFloat(5.0, "EUR")).toEqual({ amount: 500, currency: "EUR" });
  });

  it("converts zero correctly", () => {
    expect(MoneyUtils.fromFloat(0)).toEqual({ amount: 0, currency: "USD" });
  });
});
