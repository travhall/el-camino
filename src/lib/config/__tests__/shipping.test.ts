import { describe, it, expect } from "vitest";
import {
  FREE_SHIPPING_THRESHOLD_DOLLARS,
  FLAT_RATE_SHIPPING_DOLLARS,
  SHIPPING_RATES,
} from "../shipping";

describe("shipping config constants", () => {
  it("derives the free shipping threshold from SHIPPING_RATES", () => {
    expect(FREE_SHIPPING_THRESHOLD_DOLLARS).toBe(75);
  });

  it("derives the flat rate shipping cost from SHIPPING_RATES", () => {
    expect(FLAT_RATE_SHIPPING_DOLLARS).toBe(5.99);
  });

  it("fails loudly if the 'free' or 'standard' rate is ever removed", () => {
    expect(SHIPPING_RATES.find((r) => r.id === "free")).toBeDefined();
    expect(SHIPPING_RATES.find((r) => r.id === "standard")).toBeDefined();
  });
});
