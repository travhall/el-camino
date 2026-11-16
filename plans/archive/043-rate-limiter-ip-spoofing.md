# Plan 043: Fix spoofable client IP key in rate limiter

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/lib/rateLimit.ts`
> If any changes appear, compare the "Current state" excerpts before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

`clientIp()` in `src/lib/rateLimit.ts` reads the first comma-separated value
from the `x-forwarded-for` header. On Netlify, the platform-trusted header is
`x-nf-client-connection-ip`, which is injected by the CDN edge and cannot be
spoofed by clients. The `X-Forwarded-For` header, by contrast, can be set
arbitrarily by the client.

This makes the rate limiter ineffective: an attacker can rotate arbitrary
values in `X-Forwarded-For` to get a fresh rate-limit bucket on every attempt,
bypassing the 8-attempts/15-min brute-force protection on the admin login
endpoint (`src/pages/api/admin-auth.ts:34`), the checkout rate limiter
(`src/pages/api/create-checkout.ts:151`), and the back-in-stock form limiter
(`src/pages/api/back-in-stock.ts:16`).

The fix is one line: prefer `x-nf-client-connection-ip`, fall back to the
LAST (not first) value in `x-forwarded-for` (the last hop is the one the CDN
appended — untrusted but harder to spoof than the first), then fall back to
`"unknown"`.

## Current state

**`src/lib/rateLimit.ts`** — rate limiter; `clientIp` exported at line 33:

```typescript
// line 33–36
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0].trim() || "unknown";
}
```

Callers:
- `src/pages/api/admin-auth.ts:34` — `adminLimiter.check(clientIp(request))`
- `src/pages/api/create-checkout.ts:151` — `checkoutLimiter.check(clientIp(request))`
- `src/pages/api/back-in-stock.ts:16` — `bisLimiter.check(clientIp(request))`

No callers need to change — only `clientIp()` itself.

## Commands you will need

| Purpose   | Command              | Expected on success       |
|-----------|----------------------|---------------------------|
| Typecheck | `pnpm check`         | exit 0, no errors         |
| Unit tests | `pnpm test:run`     | all pass                  |

## Scope

**In scope**:
- `src/lib/rateLimit.ts`

**Out of scope**:
- All callers of `clientIp()` — the signature and return type are unchanged
- Any test file — the rate limiter has no unit tests; adding tests is deferred

## Git workflow

- Branch: `advisor/043-rate-limiter-ip-spoofing`
- Commit message: `fix: key rate limiter on Netlify-trusted x-nf-client-connection-ip`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Update clientIp() to use the platform-trusted header

Replace the `clientIp` function body in `src/lib/rateLimit.ts`:

```typescript
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

**Verify**: `grep -A 6 'export function clientIp' src/lib/rateLimit.ts` → shows the new body with `x-nf-client-connection-ip` first.

### Step 2: Typecheck

```bash
pnpm check
```
Expected: exit 0, no errors.

### Step 3: Run tests

```bash
pnpm test:run
```
Expected: all existing tests pass. (The rate limiter has no unit tests today;
if tests exist for `clientIp`, verify they pass with the new implementation.)

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep 'x-nf-client-connection-ip' src/lib/rateLimit.ts` → matches
- [ ] `grep 'split(",")[0]' src/lib/rateLimit.ts` → no matches (old first-hop logic gone)
- [ ] No files outside `src/lib/rateLimit.ts` are modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `pnpm check` errors on `clientIp` — check that the function signature
  (`request: Request`): `string` is unchanged.
- A caller file errors after the change — the return type is still `string`;
  investigate before proceeding.

## Maintenance notes

- Local development does not send `x-nf-client-connection-ip` (only Netlify's
  CDN does). In local dev, the fallback to the last XFF hop will be used; if
  `x-forwarded-for` is also absent, `"unknown"` is returned. This means all
  local requests share one rate-limit bucket (`"unknown"`), which is fine for
  development.
- If the project is ever deployed to a different platform, re-audit this
  function — `x-nf-client-connection-ip` is Netlify-specific.
