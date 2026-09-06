# Plan 113: Add eviction to the in-memory rate limiter's bucket Map

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8ff3096..HEAD -- src/lib/rateLimit.ts`
> If this file changed since this plan was written, compare the "Current
> state" excerpt below against the live file before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `8ff3096`, 2026-08-06

## Why this matters

`src/lib/rateLimit.ts`'s `createRateLimiter()` closes over an in-memory
`Map<string, Bucket>` keyed by client identifier (IP address, via
`clientIp()`). Entries are added on first sight of a key or when a key's
window expires, but **no code path ever removes an entry** — the map only
grows for the lifetime of the closure:

```ts
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
```

This limiter backs four separate rate limiters instantiated at module load
in `src/pages/api/calculate-cart.ts`, `src/pages/api/create-checkout.ts`,
`src/pages/api/admin-auth.ts`, and `src/pages/api/back-in-stock.ts` — each
one keyed by client IP. On a warm, reused Netlify function instance seeing
real traffic over time (many distinct visitor IPs across many requests),
each of these four `buckets` maps grows without bound for the life of the
instance — a slow, uncapped memory leak. `src/lib/cache/blobCache.ts`
already has the pattern to mirror for this exact class of problem: a
periodic `setInterval` sweep (`cleanupFallbackCache`, invoked every 5
minutes, `blobCache.ts:63-67`) that prunes stale in-memory state.

## Current state

- `src/lib/rateLimit.ts` (full file, 41 lines):
  ```ts
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
  ```
- The four call sites (each instantiates its own independent limiter with
  its own `windowMs`/`max`, confirm these values are unchanged before
  editing since they're not part of this plan's scope):
  - `src/pages/api/calculate-cart.ts:11` — `createRateLimiter({ windowMs: 5 * 60_000, max: 30 })`
  - `src/pages/api/admin-auth.ts:27` — `createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8 })`
  - `src/pages/api/create-checkout.ts:28` — `createRateLimiter({ windowMs: 5 * 60_000, max: 10 })`
  - `src/pages/api/back-in-stock.ts:13` — `createRateLimiter({ windowMs: 60_000, max: 5 })`
- `src/lib/cache/blobCache.ts:63-67` — the pattern this codebase already
  uses for periodic in-memory cleanup, worth matching in style (a
  `setInterval` doing periodic pruning), though `rateLimit.ts` has no class
  or `destroy()` lifecycle to hook into (it's a plain closure factory) — see
  Step 1 for how to adapt the pattern to this shape.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|----------------------|
| Typecheck | `pnpm check`     | exit 0, "0 errors" |
| Tests     | `pnpm test:run -- rateLimit` | all pass |
| Lint      | `pnpm lint`      | exit 0 |
| Build     | `pnpm build`     | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/lib/rateLimit.ts`
- `src/lib/__tests__/rateLimit.test.ts`

**Out of scope** (do NOT touch, even though they look related):
- The four call sites listed above — no change needed there; the fix is
  entirely internal to `createRateLimiter()`'s closure.
- `clientIp()` — unrelated, don't touch.
- `windowMs`/`max` values at any call site — out of scope, this plan only
  adds eviction, not policy changes.
- `src/lib/cache/blobCache.ts` — read-only reference for the existing
  cleanup-pattern style; do not modify it.

## Git workflow

- Branch: `advisor/113-bound-ratelimit-bucket-map`
- Commit message style: conventional commits, e.g. `fix: evict expired
  buckets from in-memory rate limiter to bound memory growth` (matches
  `28d7b68 fix: validate productUrl scheme, encode gallery src, encode
  cookie value` in `git log`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add lazy eviction on each `check()` call, plus a periodic sweep

Two complementary mechanisms, both needed since this is a plain closure
(no explicit lifecycle/`destroy()` hook exists to run cleanup on, unlike
`BlobCache`, which is a class instance with a constructor to set up a
`setInterval` in):

1. **Lazy eviction inside `check()`**: since every call already reads
   `entry.firstAt` and compares it to `now`, extend the existing
   expired-entry branch to also delete the *previous* entry rather than
   just overwriting it (this doesn't change behavior — `Map.set` on an
   existing key already replaces it — this part is here for clarity, not a
   functional gap. The real gap is bullet 2.)
2. **Periodic sweep**: add a module-scope (not per-limiter — see note
   below) `setInterval` that iterates all buckets and deletes any entry
   whose `now - entry.firstAt > windowMs` for that specific limiter's
   configured window, run on the same 5-minute cadence `blobCache.ts` uses
   for consistency. Since each `createRateLimiter()` call produces an
   independent closure over its own `buckets` Map, register the sweep
   *inside* `createRateLimiter()` itself so each limiter cleans its own
   map with its own `windowMs`:

```ts
export function createRateLimiter(opts: { windowMs: number; max: number }): Limiter {
  const buckets = new Map<string, Bucket>();

  const sweep = () => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (now - entry.firstAt > opts.windowMs) {
        buckets.delete(key);
      }
    }
  };
  const sweepInterval = setInterval(sweep, 5 * 60_000);
  // Unref so this timer doesn't keep the process alive on its own
  // (Node-specific; matches this codebase's serverless-function runtime).
  if (typeof sweepInterval.unref === 'function') {
    sweepInterval.unref();
  }

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
```

Notes for the executor:
- `unref()` matters here because this codebase runs on Netlify serverless
  functions — an un-unref'd interval could in principle keep a function
  instance's event loop alive longer than necessary between invocations.
  Guard with `typeof sweepInterval.unref === 'function'` since `unref` is
  Node-specific and not guaranteed present in every JS runtime this code
  might theoretically run under (defensive, matches this codebase's general
  care around runtime portability — check `blobCache.ts` for a similar
  guard pattern if one exists, and match it if so).
- Since each of the four call sites creates its own `createRateLimiter()`
  instance at module load, this produces four independent sweep intervals
  total, each on its own limiter's `windowMs`-relative cadence but using
  the shared 5-minute sweep frequency — this is intentional and matches the
  existing `BlobCache` cleanup cadence; do not try to consolidate into a
  single shared interval across limiters, that would add unnecessary
  cross-module coupling for a marginal gain.

**Verify**: `grep -n "setInterval" src/lib/rateLimit.ts` → 1 match, inside `createRateLimiter`.

### Step 2: Add a regression test for eviction

Using the existing test file's structure (it likely already uses
`vi.useFakeTimers()`/timer manipulation for the "window expiry" describe
block visible in the current file — check before adding a new fake-timer
setup if one is already scoped to a nested `describe`), add a test that:
creates a limiter, calls `check()` with several distinct keys, advances
fake time well past `windowMs` plus the 5-minute sweep interval, and
asserts the internal state was pruned. Since `buckets` is private to the
closure and not exposed, test this indirectly — e.g. by triggering the
sweep via advanced fake timers and confirming a `keys` count or memory
proxy is observable, OR (simpler, and consistent with this file's existing
black-box testing style) just assert `check()` still behaves correctly
after the sweep would have run (a key that was evicted and re-seen should
be treated as a fresh key, not accumulate stale count — this is
observable behavior, not an internals leak).

**Verify**: `pnpm test:run -- rateLimit` → all pass, including the new case.

## Test plan

- New test in `src/lib/__tests__/rateLimit.test.ts`: after advancing fake
  timers past `windowMs` and the sweep interval, a previously-tracked key
  behaves as if it were never seen (fresh `count: 1` on next `check()`) —
  this is the black-box-observable proof the sweep ran and cleared state,
  matching this file's existing testing style (it doesn't reach into
  `buckets` directly today, per the current file's black-box `describe`
  blocks).
- Verification: `pnpm test:run -- rateLimit` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0, "0 errors"
- [ ] `pnpm test:run -- rateLimit` exits 0, new test passing
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -n "setInterval" src/lib/rateLimit.ts` → 1 match
- [ ] No files outside the Scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 113 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/lib/rateLimit.ts` doesn't match the "Current state" excerpt above
  (drift since this plan was written).
- Any of the four call sites turn out to construct limiters somewhere
  other than module scope (e.g. per-request) — that would change the
  urgency/shape of this fix substantially (a per-request limiter wouldn't
  have the same accumulation problem); re-verify with
  `grep -n "createRateLimiter" src/pages/api/*.ts` before proceeding if
  this seems off from what's documented above.
- `unref()` is unavailable in this codebase's actual deploy runtime in a
  way that causes a build or runtime error — if so, drop the `unref()` call
  (it's a defensive nicety, not load-bearing for correctness) rather than
  blocking the whole fix on it, but note this in your commit message.

## Maintenance notes

- If a fifth rate-limited route is added in the future, it automatically
  gets this same eviction behavior for free (it's internal to
  `createRateLimiter`, not something each call site has to opt into).
- A reviewer should confirm the sweep interval doesn't fire so often that
  it becomes its own overhead source — 5 minutes matches the existing
  `BlobCache` cadence and is a reasonable default; no data suggests
  otherwise.
- This does not change the limiter's documented per-instance limitation
  (see the file's own header comment) — a determined attacker can still
  distribute a burst across cold Netlify function instances. This plan is
  strictly a memory-bound fix for the warm-instance case, not a
  distributed-rate-limiting upgrade.
