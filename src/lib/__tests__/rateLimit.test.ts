import { describe, it, expect, vi, afterEach } from "vitest";
import { createRateLimiter, clientIp } from "../rateLimit";

describe("createRateLimiter", () => {
  it("allows requests up to and including the max within the window", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    expect(limiter.check("1.1.1.1")).toBe(false);
    expect(limiter.check("1.1.1.1")).toBe(false);
    expect(limiter.check("1.1.1.1")).toBe(false);
  });

  it("blocks requests once the count exceeds max", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    limiter.check("2.2.2.2");
    limiter.check("2.2.2.2");
    expect(limiter.check("2.2.2.2")).toBe(true);
  });

  it("tracks each key independently", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    limiter.check("3.3.3.3");
    expect(limiter.check("3.3.3.3")).toBe(true); // exceeded for this key
    expect(limiter.check("4.4.4.4")).toBe(false); // untouched key, not limited
  });

  describe("window expiry", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("resets the count once the window has elapsed", () => {
      vi.useFakeTimers();
      const limiter = createRateLimiter({ windowMs: 1000, max: 1 });

      limiter.check("5.5.5.5");
      expect(limiter.check("5.5.5.5")).toBe(true); // limited within the window

      vi.advanceTimersByTime(1001);

      expect(limiter.check("5.5.5.5")).toBe(false); // window elapsed, fresh bucket
    });

    it("evicts stale buckets via the periodic sweep, not just on next check", () => {
      vi.useFakeTimers();
      const limiter = createRateLimiter({ windowMs: 1000, max: 1 });

      limiter.check("6.6.6.6");
      expect(limiter.check("6.6.6.6")).toBe(true); // limited within the window

      // Advance past the window and the 5-minute sweep cadence so the
      // periodic sweep (not lazy eviction on check()) prunes the entry.
      vi.advanceTimersByTime(5 * 60_000 + 1000);

      // A fresh check after the sweep should behave as if the key was never
      // seen: count resets to 1, not limited.
      expect(limiter.check("6.6.6.6")).toBe(false);
    });
  });
});

describe("clientIp", () => {
  it("prefers x-nf-client-connection-ip when present", () => {
    const req = new Request("http://test/", {
      headers: { "x-nf-client-connection-ip": "1.2.3.4" },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to the LAST value of x-forwarded-for (least client-controllable hop)", () => {
    const req = new Request("http://test/", {
      headers: { "x-forwarded-for": "attacker-supplied, 5.6.7.8" },
    });
    expect(clientIp(req)).toBe("5.6.7.8");
  });

  it("prefers the Netlify header over x-forwarded-for when both are present", () => {
    const req = new Request("http://test/", {
      headers: {
        "x-nf-client-connection-ip": "9.9.9.9",
        "x-forwarded-for": "1.1.1.1",
      },
    });
    expect(clientIp(req)).toBe("9.9.9.9");
  });

  it("returns 'unknown' when neither header is present", () => {
    const req = new Request("http://test/");
    expect(clientIp(req)).toBe("unknown");
  });

  it("trims whitespace around the resolved IP", () => {
    const req = new Request("http://test/", {
      headers: { "x-forwarded-for": "1.1.1.1,  2.2.2.2  " },
    });
    expect(clientIp(req)).toBe("2.2.2.2");
  });
});
