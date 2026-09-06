# Plan 169: Make admin sessions revocable

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If anything in "STOP conditions" occurs, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/lib/admin/auth.ts src/pages/api/admin-auth.ts src/pages/api/admin-logout.ts src/middleware.ts`
> On any change, compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

There is no way to invalidate an issued admin session.

The session token is an HMAC over `${iat}.${exp}` keyed by `ADMIN_SECRET`.
Nothing in the payload references the password or any session generation, so:

- **Logout is client-side only** — `admin-logout.ts` just deletes the cookie. A
  token captured before logout stays valid for the rest of its **7 days**.
- **Changing `ADMIN_PASSWORD` after a suspected compromise signs nobody out.**
- The only remediation is rotating `ADMIN_SECRET`, which is not documented
  anywhere as an incident-response step.

Everything else here is sound and must be preserved: constant-time comparison,
`HttpOnly`/`Secure`/`SameSite=Strict` cookie flags, an enforced `exp`, a length
guard before `timingSafeEqual`, and the `assertSameOrigin` CSRF layer. This plan
adds one thing; it does not restructure the module.

## Current state

`src/lib/admin/auth.ts:15-46`:

```ts
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function hmac(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function issueSessionToken(secret: string, ttlSeconds = ADMIN_SESSION_TTL_SECONDS): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSeconds;
  const payload = `${iat}.${exp}`;
  return `${payload}.${hmac(secret, payload)}`;
}

export function verifySessionToken(secret: string, token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [iatStr, expStr, sig] = parts;
  const iat = Number(iatStr);
  const exp = Number(expStr);
  if (!Number.isFinite(iat) || !Number.isFinite(exp)) return false;
  if (Math.floor(Date.now() / 1000) >= exp) return false;
  const expected = hmac(secret, `${iatStr}.${expStr}`);
  return safeEqual(sig, expected);
}
```

`src/pages/api/admin-logout.ts`:

```ts
export const POST: APIRoute = ({ request, cookies, redirect }) => {
  if (!assertSameOrigin(request)) {
    return new Response("Forbidden", { status: 403 });
  }
  cookies.delete(ADMIN_COOKIE_NAME, { path: "/" });
  return redirect("/admin/login");
};
```

`src/middleware.ts` calls `verifySessionToken` to gate `/admin/*`; all 15 routes
under `src/pages/api/admin/` call `isAdminAuthenticated` individually.

## Commands you will need

| Purpose   | Command                        | Expected             |
|-----------|--------------------------------|----------------------|
| Typecheck | `pnpm check`                   | exit 0               |
| Tests     | `pnpm test:run -- auth admin`  | all pass             |
| Full      | `pnpm test:run`                | exit 0               |
| Coverage  | `pnpm test:coverage`           | exit 0, no regression|
| Lint      | `pnpm lint`                    | exit 0               |
| Dev server| `pnpm dev`                     | serves on :4321      |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/lib/admin/auth.ts`
- `src/lib/admin/__tests__/` (the existing auth test file)
- `README.md` — only to document the rotation/revocation procedure

**Out of scope** (do NOT touch):
- `safeEqual` / `timingSafeEqual`, the length guard, the `exp` check, or the
  cookie flags. All correct.
- `assertSameOrigin` and the CSRF layer.
- `src/middleware.ts` and the 15 admin API routes — they call
  `verifySessionToken` / `isAdminAuthenticated`, whose signatures should not
  change if you can avoid it.
- Introducing server-side session storage. That is a much larger change; the
  stateless approach here is fine once it binds to a rotatable value.
- **Do not reduce `ADMIN_SESSION_TTL_SECONDS`** as a substitute fix — that is a
  different tradeoff and does not give revocation.

## Git workflow

- Branch: `advisor/169-make-admin-sessions-revocable`
- Conventional commits, e.g. `fix(security): bind admin sessions to a rotatable generation`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Choose the binding value

Two options; pick one and record why.

- **(a) Hash of the current `ADMIN_PASSWORD`** — changing the password
  automatically invalidates every session. Zero new configuration. **Recommended.**
- **(b) An explicit `ADMIN_SESSION_GENERATION` env var** — an explicit "log
  everyone out" lever, independent of the password, but requires the operator to
  know it exists.

(a) is recommended because it makes the intuitive action — change the password —
do the right thing. Note that `ADMIN_PASSWORD` is already read at login
(`src/pages/api/admin-auth.ts`); confirm it is available where tokens are
verified, not just where they are issued. **If it is not, say so — that changes
the answer to (b).**

**Verify**: decision and the availability check recorded in `plans/README.md`.

### Step 2: Include the binding in the HMAC payload

Extend the signed payload from `${iat}.${exp}` to include a short derived
generation value. Keep the token's three-part `a.b.sig` shape if you can, so
`verifySessionToken`'s parsing and all its guards stay as they are — e.g. keep
signing `${iat}.${exp}` as the token body but **key or salt** the HMAC with the
generation, so an old generation simply fails signature verification.

That approach changes no signatures, no cookie shape, and no call sites — only
what the HMAC covers.

Never log or expose the binding value; it is derived from a credential.

**Verify**: `pnpm check` → exit 0. `pnpm test:run -- auth` → existing tests pass
(they may need the new input threaded through; that is expected).

### Step 3: Verify revocation actually works

With `pnpm dev`:

1. Log into `/admin`, confirm access.
2. Change `ADMIN_PASSWORD` in `.env` (option a) or bump the generation var
   (option b). Restart the server.
3. Reload an admin page **with the same cookie**.

**Verify**: you are redirected to login. Then log in with the new password and
confirm access is restored. This is the plan's primary evidence — record it.

### Step 4: Document the incident-response procedure

Add a short section to `README.md`: how to revoke all admin sessions, and that
`ADMIN_SECRET` rotation is the fallback if the password binding is unavailable.

Reference **variable names only** — never any value.

**Verify**: `grep -n "ADMIN_SECRET\|revoke" README.md` → the procedure is present
and contains no secret values.

### Step 5: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm test:coverage
```
→ all exit 0.

## Test plan

Extend the existing admin auth test file:

- a token issued under generation A **fails** verification under generation B
  (the revocation proof)
- a token issued and verified under the same generation passes
- an expired token still fails (regression — the `exp` check must survive)
- a tampered signature still fails
- a token with the wrong number of parts still fails
- constant-time comparison is still used (assert the length-mismatch early return)

`pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

- [x] Step 1's option and the `ADMIN_PASSWORD` availability finding recorded
- [x] A test proves a token from a previous generation fails verification
- [x] All existing auth tests still pass (expiry, tampering, malformed token)
- [x] Step 3's manual revocation check performed and recorded
- [x] Cookie flags, `safeEqual`, `exp` check, and `assertSameOrigin` unchanged
- [x] `ADMIN_SESSION_TTL_SECONDS` unchanged
- [x] README documents the revocation procedure with **no secret values**
- [x] `pnpm check` / `pnpm lint` / `pnpm test:run` all exit 0

## STOP conditions

Stop and report if:

- **`ADMIN_PASSWORD` is not available in the verification path** (only at login).
  Switch to option (b) and say so — do not plumb a credential into new places to
  make option (a) work.
- Making the change would alter `verifySessionToken`'s or `isAdminAuthenticated`'s
  signature, forcing edits across `src/middleware.ts` and 15 admin routes. There
  is a way to do this without that; find it or report.
- You are tempted to weaken any existing check to fit the new payload. Don't.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Deploying this logs out every current admin session once.** Expected and
  harmless — but say so in the PR description so it is not mistaken for a bug.
- **The property to preserve**: a credential change must invalidate outstanding
  sessions. Any future change to token issuance has to keep that binding.
- A reviewer should confirm the binding value never appears in a log, an error
  message, or the token itself.
- **Deliberately deferred**: server-side session storage with per-session
  revocation, and shortening the 7-day TTL. Both reasonable, both bigger
  conversations.
