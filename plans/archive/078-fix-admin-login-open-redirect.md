# Plan 078: Fix open redirect in admin login `?from=` parameter

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 915a062..HEAD -- src/pages/admin/login.astro src/middleware.ts`
> If either in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`src/pages/admin/login.astro:16` reads the `?from=` query parameter and passes
it unvalidated to `Astro.redirect()`. An attacker can craft a link:

```
https://your-domain.com/admin/login?from=https://evil.com
```

After the admin enters the correct password (at `src/pages/api/admin-auth.ts`,
which also processes `from` from the POST body), the session is established and
the browser is redirected to `https://evil.com`. The green padlock on the login
page builds trust; the redirect lands on a phishing site. This is a textbook
open-redirect vulnerability.

The same parameter is rendered into a hidden form field on the login page
(`from line 21`) and the form POSTs it to `src/pages/api/admin-auth.ts` which
also redirects to it. Both locations must be fixed.

The fix is simple: validate that `dest` starts with `/` (site-relative path)
before redirecting. Absolute URLs (`https://`, `javascript:`, `//`, etc.) get
replaced with the safe default `/admin`.

## Current state

**File**: `src/pages/admin/login.astro`, lines 16–17:

```typescript
const dest = Astro.url.searchParams.get("from") || "/admin";
return Astro.redirect(dest);  // no validation — accepts any URL
```

And line 21 (renders the unvalidated value into the POST form):

```typescript
const from = Astro.url.searchParams.get("from") || "/admin";
```

**File**: `src/pages/api/admin-auth.ts` — also reads `from` from the form POST
body and redirects to it. Read this file before editing to confirm it has the
same pattern; fix it in the same PR.

**File**: `src/middleware.ts`, line 24:

```typescript
loginUrl.searchParams.set("from", url.pathname);
```

The middleware sets `from` to `url.pathname` (no origin, always site-relative)
— this is safe and does not need to change.

## Commands you will need

| Purpose   | Command      | Expected on success |
|-----------|--------------|---------------------|
| Typecheck | `pnpm check` | exit 0, no errors   |

## Scope

**In scope**:
- `src/pages/admin/login.astro`
- `src/pages/api/admin-auth.ts`

**Out of scope**:
- `src/middleware.ts` — middleware already sets `from` to `url.pathname` (safe)
- Any other auth files

## Git workflow

- Branch: `advisor/078-fix-admin-login-open-redirect`
- Commit: `fix: reject non-relative redirect destinations in admin login`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add a helper function to sanitize the redirect destination

In `src/pages/admin/login.astro`, at the top of the frontmatter script (before
the existing code), add:

```typescript
function safeRedirectDest(raw: string | null, fallback = "/admin"): string {
  if (!raw) return fallback;
  // Only allow site-relative paths: must start with / and not with //
  // (// would be protocol-relative, treated as absolute by browsers)
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return fallback;
}
```

Then change:
```typescript
// Before:
const dest = Astro.url.searchParams.get("from") || "/admin";
return Astro.redirect(dest);

// After:
const dest = safeRedirectDest(Astro.url.searchParams.get("from"));
return Astro.redirect(dest);
```

And line 21:
```typescript
// Before:
const from = Astro.url.searchParams.get("from") || "/admin";

// After:
const from = safeRedirectDest(Astro.url.searchParams.get("from"));
```

**Verify**: `pnpm check` → exit 0

### Step 2: Apply the same fix in admin-auth.ts

Read `src/pages/api/admin-auth.ts` and find where it reads `from` from the
POST body and calls `redirect()` or returns a `Response` with a `Location`
header. Apply the same `safeRedirectDest` function (copy it, or import it if
it's extracted to a shared utility).

**Verify**: `pnpm check` → exit 0

### Step 3: Verify manually (no test framework needed)

The fix is a one-liner guard; no automated test is required beyond typechecking.
Document the check in the plan's done criteria instead:

- `?from=https://evil.com` → redirects to `/admin`
- `?from=//evil.com` → redirects to `/admin`
- `?from=javascript:alert(1)` → redirects to `/admin`
- `?from=/admin/settings` → redirects to `/admin/settings`
- `?from=` (empty) → redirects to `/admin`

If the project has existing admin-auth tests, add a test case there.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `safeRedirectDest` rejects any `from` that doesn't start with `/` or starts with `//`
- [ ] Both `login.astro` and `admin-auth.ts` use the guard
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `admin-auth.ts` does not redirect to `from` at all (already fixed elsewhere)
- `from` parameter is read from somewhere other than the query string / POST body (e.g. a cookie) — trace the full flow before editing

## Maintenance notes

- If admin auth is ever migrated to a third-party provider (Auth.js, Clerk, etc.), ensure the new provider has its own redirect-validation; `safeRedirectDest` would no longer be in the critical path.
- `safeRedirectDest` is a pure function; extract it to `src/lib/admin/auth.ts` if a second call site appears.
