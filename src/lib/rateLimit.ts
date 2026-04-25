// Per-instance, in-memory rate limiter keyed by client identifier.
//
// Limitations: state is per Netlify function instance, so a determined
// attacker can amplify by hitting different cold instances. For the use cases
// here (admin login, public form submissions) it raises the cost enough to
// stop casual abuse without needing a Redis dep.

interface Bucket {
  count: number;
  firstAt: number;
}

interface Limiter {
  check: (key: string) => boolean; // true if rate-limited
}

export function createRateLimiter(opts: { windowMs: number; max: number }): Limiter {
  const buckets = new Map<string, Bucket>();
  return {
    check(key: string): boolean {
      const now = Date.now();
      const entry = buckets.get(key);
      if (!entry || now - entry.firstAt > opts.windowMs) {
        buckets.set(key, { count: 1, firstAt: now });
        return false;
      }
      entry.count += 1;
      return entry.count > opts.max;
    },
  };
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0].trim() || "unknown";
}
