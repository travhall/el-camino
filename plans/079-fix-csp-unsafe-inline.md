# Plan 079: Replace `unsafe-inline` script-src with nonce-based CSP

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 915a062..HEAD -- netlify.toml src/middleware.ts`
> If either in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`netlify.toml:111` sets `script-src 'self' 'unsafe-inline' ...` and
`style-src 'self' 'unsafe-inline'`. The `'unsafe-inline'` directive nullifies
the XSS protection that a CSP is designed to provide — any injected inline
`<script>` or `<style>` runs without restriction. The existing comment at
`netlify.toml:104-110` documents that this is a known gap caused by 17
`<script is:inline>` blocks remaining in the codebase.

The correct fix is nonce-based CSP: the server generates a random nonce per
request, injects it into every `<script>` and `<style>` tag that needs it,
and sends it in the `Content-Security-Policy` header as
`'nonce-<value>'` instead of `'unsafe-inline'`. Browsers only run scripts
whose nonce matches.

This is an L-effort change because it touches `src/middleware.ts`, Astro's
layout hierarchy, and every `<script is:inline>` block.

## Current state

**File**: `netlify.toml`, line 111:

```toml
Content-Security-Policy = "default-src 'self'; ... script-src 'self' 'unsafe-inline' ...; style-src 'self' 'unsafe-inline'; ..."
```

**File**: `netlify.toml`, lines 104-110 (comment):

```
# NOTE: 'unsafe-inline' for script-src covers two distinct patterns:
#   1. Inline HTML event handlers (onload, onerror, onclick, etc.) — these have
#      been fully refactored away; see src/scripts/imageShimmer.ts.
#   2. <script is:inline> blocks — 17 instances remain throughout the codebase
#      (Square SDK loader, header animation, Speculation Rules, NewsFilters, etc.).
#      Removing 'unsafe-inline' requires converting all of these to bundled modules
#      or adopting a nonce-based CSP. That is a separate effort.
```

Run this to get the current count and locations of inline scripts:
```bash
grep -r "is:inline" src/ --include="*.astro" -l
```

## Commands you will need

| Purpose   | Command      | Expected on success            |
|-----------|--------------|--------------------------------|
| Typecheck | `pnpm check` | exit 0, no errors              |
| Dev test  | `pnpm dev`   | site loads, no CSP violations in browser console |

## Scope

**In scope**:
- `src/middleware.ts` — add nonce generation and header injection
- `src/layouts/Layout.astro` — thread nonce to `<script>` and `<style>` tags
- `src/layouts/AdminLayout.astro` — same
- All `.astro` files that contain `<script is:inline>` — add `nonce={nonce}` attribute
- `netlify.toml` — remove `'unsafe-inline'` from `script-src` and `style-src`, add `'nonce-'` placeholder (see Astro docs for the right format)

**Out of scope**:
- Third-party scripts loaded via `<script src="https://...">` — those are
  covered by the existing allowlist, not by nonce
- `<style>` blocks that are purely Tailwind/Astro-generated — confirm these
  don't need a nonce; Astro may handle them automatically

## Git workflow

- Branch: `advisor/079-fix-csp-unsafe-inline`
- Commit: `fix: replace unsafe-inline CSP with nonce-based policy`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Inventory all inline script locations

```bash
grep -rn "is:inline" src/ --include="*.astro"
```

List every file. This is the work scope. If the count is significantly more
than 17, recount and confirm before proceeding.

### Step 2: Generate a nonce in middleware

In `src/middleware.ts`, generate a cryptographically random nonce per request
and attach it to `Astro.locals`:

```typescript
import { defineMiddleware } from "astro:middleware";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin/auth";
import { randomBytes } from "node:crypto";

export const onRequest = defineMiddleware(({ url, cookies, redirect, locals }, next) => {
  // Generate a per-request nonce for CSP
  (locals as any).nonce = randomBytes(16).toString("base64");

  // ... existing admin auth logic unchanged ...
});
```

Declare the nonce type in `src/env.d.ts` (or equivalent Astro locals
declaration file):
```typescript
declare namespace App {
  interface Locals {
    nonce: string;
  }
}
```

**Verify**: `pnpm check` → exit 0

### Step 3: Thread nonce through Layout.astro and AdminLayout.astro

In both layout files, read `Astro.locals.nonce` and pass it as `nonce` to
every `<script>` and `<style>` tag that has `is:inline`:

```astro
---
const nonce = Astro.locals.nonce;
---
<script is:inline nonce={nonce}>
  // ... unchanged content ...
</script>
```

Astro will render `nonce="<value>"` on the tag; the browser will verify it
against the CSP header.

### Step 4: Add nonce attribute to all remaining inline scripts

For each file found in Step 1, pass the nonce from the nearest parent
component that has access to `Astro.locals`. If a component is deep in the
tree and doesn't receive the nonce, either:
- Add a `nonce` prop to the component, or
- Import `Astro.locals.nonce` directly (available in any `.astro` file)

### Step 5: Set the nonce in the CSP header

The nonce must be in the response `Content-Security-Policy` header, NOT in
a static `netlify.toml` line (because it changes per request). Remove the
static CSP from `netlify.toml` (or keep it as a fallback without
`'unsafe-inline'`) and set the header in middleware:

```typescript
const response = await next();
response.headers.set(
  "Content-Security-Policy",
  `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://sandbox.web.squarecdn.com https://web.squarecdn.com; style-src 'self' 'nonce-${nonce}'; img-src 'self' https: data: *.wordpress.com; font-src 'self' https:; connect-src 'self' https: wss:; frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com; object-src 'none'; base-uri 'self'; form-action 'self'`
);
return response;
```

### Step 6: Verify in browser

```bash
pnpm dev
```

Open the site, open DevTools → Console. There should be no CSP violation
messages. If there are, the error message will identify which specific resource
or inline script was blocked; add the nonce to that element.

**Verify**: No CSP violations for normal site navigation, cart, and checkout pages.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `'unsafe-inline'` removed from `script-src` in the active CSP
- [ ] Every `<script is:inline>` has `nonce={nonce}`
- [ ] No CSP violations in browser console on main site pages
- [ ] The nonce is set per-request (not static) in the middleware or response handler
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- More than 25 inline scripts found — re-scope and split the work; do not attempt all at once
- Astro's built-in `<script>` bundling automatically handles nonces via a different mechanism — read the current Astro docs before proceeding
- A Square-required script (Square Web Payments SDK loader) doesn't accept a nonce — keep it in the allowlist, not the nonce path

## Maintenance notes

- Every new `<script is:inline>` added in the future must include `nonce={Astro.locals.nonce}` or the CSP will block it in production.
- Consider adding a CI lint rule (`grep -r "is:inline" src/ --include="*.astro"` that checks each result also contains `nonce`) to catch regressions.
- The nonce approach does NOT protect against stored XSS where an attacker injects a `<script nonce="...">` — nonces are per-response and unknown to attackers who can't read response headers.
