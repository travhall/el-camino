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
  // x-nf-client-connection-ip is injected by Netlify's CDN edge and cannot
  // be spoofed by clients; fall back to the last XFF hop (least controllable).
  const nf = request.headers.get("x-nf-client-connection-ip");
  if (nf) return nf.trim();
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  const parts = fwd.split(",");
  return parts[parts.length - 1].trim() || "unknown";
}
