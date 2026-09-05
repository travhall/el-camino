# Plan 045: Admin security microhardening — social URL validation, logout CSRF, unified auth rejection

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/pages/api/admin src/components/Modal.astro src/lib/admin/auth.ts src/pages/api/admin-logout.ts`
> If any changes appear, compare the "Current state" excerpts before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

Three related admin security gaps bundled into one plan:

1. **Social link `javascript:` injection** (`Modal.astro:244`): Admin social-link
   `url` values are stored without URL scheme validation (`admin/social.ts:33-35`)
   and interpolated directly into an `innerHTML` template `href`. A compromised
   admin account could set `javascript:alert(document.cookie)` as a social link
   URL — every storefront visitor who opens the social modal and clicks the link
   would execute arbitrary JavaScript.

2. **Admin logout CSRF** (`admin-logout.ts`): The POST handler deletes the
   session cookie with no origin check. A cross-site auto-submitting form
   targeting `/api/admin-logout` forces the browser to apply a clearing
   `Set-Cookie` response, logging the admin out. Low impact (forced re-auth,
   no privilege escalation) but trivial to fix. `assertSameOrigin` already
   exists in `src/lib/admin/auth.ts:52`.

3. **Inconsistent admin API auth rejections** (`src/pages/api/admin/*.ts`):
   `retry-failed-emails.ts` returns `302 → /admin/login` on auth failure, but
   admin API endpoints are called via `fetch()` from JavaScript — the browser
   follows the redirect silently and the calling code receives a 200 with HTML,
   never detecting the auth failure. All other admin endpoints return `401 JSON`.
   A shared `unauthorizedResponse()` helper fixes the inconsistency.

## Current state

**`src/pages/api/admin/social.ts`** — stores social links from admin POST:
```typescript
// ~line 33–35
const links = body.links as Array<{ platform: string; url: string; label?: string }>;
// url is stored directly with no scheme validation
```

**`src/components/Modal.astro`** — renders social links (line 244):
```typescript
return `<a href="${s.url}" target="_blank" rel="noopener noreferrer" ...>${icon}</a>`;
// s.url is interpolated directly into innerHTML href — no escaping, no scheme check
```

**`src/pages/api/admin-logout.ts`** — POST handler (lines 4–7):
```typescript
export const POST: APIRoute = ({ cookies, redirect }) => {
  cookies.delete(ADMIN_COOKIE_NAME, { path: "/" });
  return redirect("/admin/login");
};
```
No `assertSameOrigin` check.

**`src/lib/admin/auth.ts:52`** — `assertSameOrigin` already exists:
```typescript
export function assertSameOrigin(request: Request): boolean { ... }
```

**`src/pages/api/admin/retry-failed-emails.ts`** — auth rejection at lines 15, 27:
```typescript
return new Response(null, { status: 302, headers: { Location: "/admin/login" } });
```
All other admin API routes return `401 JSON { error: "Unauthorized" }`.

## Commands you will need

| Purpose   | Command              | Expected on success       |
|-----------|----------------------|---------------------------|
| Typecheck | `pnpm check`         | exit 0, no errors         |
| Unit tests | `pnpm test:run`     | all pass                  |

## Scope

**In scope**:
- `src/pages/api/admin/social.ts`
- `src/components/Modal.astro`
- `src/pages/api/admin-logout.ts`
- `src/lib/admin/auth.ts`
- `src/pages/api/admin/retry-failed-emails.ts` (fix 302 → 401)
- All other `src/pages/api/admin/*.ts` files if their auth rejection response
  is not already `401 JSON` (grep to find them in Step 4)

**Out of scope**:
- `src/middleware.ts` — admin route browser-navigation auth is correct; don't touch
- `src/pages/admin/` — admin UI pages are separate from API routes

## Git workflow

- Branch: `advisor/045-admin-security-microhardening`
- Commit message: `fix: validate social link URL scheme, add logout CSRF guard, unify admin 401 responses`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add scheme validation for social link URLs in admin/social.ts

Open `src/pages/api/admin/social.ts`. After parsing the request body and before
storing `links`, add scheme validation:

```typescript
const allowedSchemes = ["https:", "http:"];
for (const link of links) {
  try {
    const parsed = new URL(link.url);
    if (!allowedSchemes.includes(parsed.protocol)) {
      return new Response(
        JSON.stringify({ error: `Invalid URL scheme for ${link.platform}: only http/https allowed` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ error: `Invalid URL for ${link.platform}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
```

**Verify**: `grep -n "allowedSchemes\|new URL" src/pages/api/admin/social.ts` → both appear.

### Step 2: Use DOM property assignment in Modal.astro instead of innerHTML href

Open `src/components/Modal.astro`. Find the line ~244:
```typescript
return `<a href="${s.url}" target="_blank" rel="noopener noreferrer" aria-label="${label}" class="...">${icon}</a>`;
```

Replace the template-literal approach with element creation and property assignment:
```typescript
const anchor = document.createElement("a");
anchor.href = s.url;  // browser rejects javascript: for non-navigable contexts via property assignment in many cases
anchor.target = "_blank";
anchor.rel = "noopener noreferrer";
anchor.setAttribute("aria-label", label);
anchor.className = "p-2 border-2 border-(--border-primary) rounded-sm text-(--content-meta) hover:text-(--content-emphasis) hover:border-(--ui-nav-border) transition-all";
anchor.innerHTML = icon;
return anchor.outerHTML;
```

Note: since Step 1 validates on write, the storage-time guard is primary.
This DOM-level guard is a defence-in-depth measure.

**Verify**: `grep -n 'href="${s.url}"' src/components/Modal.astro` → no match.

### Step 3: Add assertSameOrigin to admin-logout.ts

Open `src/pages/api/admin-logout.ts`. Import `assertSameOrigin` and add a check:

```typescript
import type { APIRoute } from "astro";
import { ADMIN_COOKIE_NAME, assertSameOrigin } from "@/lib/admin/auth";

export const POST: APIRoute = ({ request, cookies, redirect }) => {
  if (!assertSameOrigin(request)) {
    return new Response("Forbidden", { status: 403 });
  }
  cookies.delete(ADMIN_COOKIE_NAME, { path: "/" });
  return redirect("/admin/login");
};
```

**Verify**: `grep -n "assertSameOrigin" src/pages/api/admin-logout.ts` → appears.

### Step 4: Add unauthorizedResponse helper to auth.ts

Open `src/lib/admin/auth.ts`. Add this export anywhere after the existing exports:

```typescript
export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
```

**Verify**: `grep -n "unauthorizedResponse" src/lib/admin/auth.ts` → appears.

### Step 5: Fix retry-failed-emails.ts to use unauthorizedResponse

Open `src/pages/api/admin/retry-failed-emails.ts`. Import `unauthorizedResponse`
from `@/lib/admin/auth` and replace both occurrences of the 302 redirect:

```typescript
// Before:
return new Response(null, { status: 302, headers: { Location: "/admin/login" } });
// After:
return unauthorizedResponse();
```

**Verify**: `grep -n "302\|Location.*admin" src/pages/api/admin/retry-failed-emails.ts` → no matches.

### Step 6: Audit all other admin API routes for inconsistent auth rejections

```bash
grep -rn "isAdminAuthenticated" src/pages/api/admin/ | grep -v "unauthorizedResponse\|401"
```

For any file that still returns something other than `401 JSON`, update it to
`return unauthorizedResponse()`. Common patterns to replace:
- `new Response(null, { status: 302, ... })` — replace with `unauthorizedResponse()`
- `new Response(JSON.stringify({ error: "unauthorized" }), ...)` (lowercase) — replace

**Verify**: `grep -rn "302\|Location.*admin/login" src/pages/api/admin/` → no matches.

### Step 7: Typecheck and test

```bash
pnpm check
```
Expected: exit 0, no errors.

```bash
pnpm test:run
```
Expected: all existing tests pass. If any admin API test asserts a 302 response,
update the assertion to expect 401.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep -n "new URL\|allowedSchemes" src/pages/api/admin/social.ts` → both match
- [ ] `grep -n 'href="${s.url}"' src/components/Modal.astro` → no match
- [ ] `grep -n "assertSameOrigin" src/pages/api/admin-logout.ts` → match
- [ ] `grep -n "unauthorizedResponse" src/lib/admin/auth.ts` → match
- [ ] `grep -rn "302\|Location.*admin/login" src/pages/api/admin/` → no matches
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `assertSameOrigin` does not exist in `src/lib/admin/auth.ts` — read the file,
  locate the actual function name, and adapt Step 3.
- `pnpm check` errors on `anchor.outerHTML` in Modal.astro — the script context
  may need DOM lib types; check `tsconfig.json` and report.
- A test asserts a 302 response from an admin route and changing it to 401 breaks
  integration expectations — note the test file and stop to discuss.

## Maintenance notes

- Any new admin API route must use `return unauthorizedResponse()` for auth
  failures — never `302` or bespoke JSON.
- The `javascript:` scheme guard in Step 1 is the primary protection; the DOM
  assignment in Step 2 is defence-in-depth. If Modal.astro is later rewritten
  as a React component or similar, carry the DOM-assignment pattern forward.
