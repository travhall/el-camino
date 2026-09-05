# Plan 080: Security hardening — productUrl scheme, gallery XSS, cookie injection

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> ```
> git diff --stat 915a062..HEAD -- src/pages/api/back-in-stock.ts src/lib/product/quickViewController.ts src/pages/api/create-checkout.ts
> ```
> If any in-scope file changed, compare excerpts below before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

Three distinct low-to-medium severity security issues, all S-effort one-line
fixes, bundled for efficiency.

**SEC-03 — productUrl stored without scheme validation (back-in-stock.ts)**

`productUrl` is taken from form body at line 30 and stored verbatim via
`addSubscription()` at line 55. The stored URL ends up as an `href` in the
admin notification email (via `src/lib/email/templates.ts`). If an attacker
submits `javascript:alert(1)` or `data:text/html,...` as the `productUrl`,
it appears as a clickable link in the admin email. Mail clients vary in how
they handle `javascript:` hrefs; some execute them. The fix: validate that
`productUrl` starts with `https://` before storing it; reject or sanitize
anything else.

**SEC-04 — unencoded image src in gallery innerHTML (quickViewController.ts)**

`src/lib/product/quickViewController.ts:219` builds gallery thumbnails via
`innerHTML` string interpolation:

```typescript
data-gallery-src="${src}"
```

If `src` contains a double-quote (`"`), it breaks out of the attribute and
can inject arbitrary HTML attributes or close the tag. The PDP version
(`src/lib/product/pdpUI.ts:437`) already has `.replace(/"/g, "&quot;")` for
exactly this reason. The QuickView gallery is missing the same guard.

**SEC-05 — cookie built via string interpolation with orderId**

`src/pages/api/create-checkout.ts:502-503` builds a `Set-Cookie` header by
string interpolation:

```typescript
const cookie = orderId
  ? `square-pending-orderId=${orderId}; Path=/; Max-Age=3600; SameSite=Lax; HttpOnly...`
  : "";
```

`orderId` comes from Square's API response and is alphanumeric in practice,
but the code has no guard. If Square ever returns an ID containing `;`,
`\n`, or `=`, the cookie header could be split or injected with extra
directives. The fix: encode the value with `encodeURIComponent` before
embedding it.

## Current state

**SEC-03** — `src/pages/api/back-in-stock.ts`, line 30:

```typescript
const productUrl = formData.get("product_url")?.toString().trim() ?? "";
// ... lines 50-57:
await addSubscription({
  email,
  productId,
  productTitle,
  variationId,
  productUrl,   // stored verbatim — no scheme check
  submittedAt: new Date().toISOString(),
});
```

**SEC-04** — `src/lib/product/quickViewController.ts`, line 219:

```typescript
data-gallery-src="${src}"
```

Compare with `src/lib/product/pdpUI.ts` which does:
```typescript
data-gallery-src="${src.replace(/"/g, "&quot;")}"`
```

**SEC-05** — `src/pages/api/create-checkout.ts`, lines 502-503:

```typescript
const cookie = orderId
  ? `square-pending-orderId=${orderId}; Path=/; ...`
  : "";
```

## Commands you will need

| Purpose   | Command      | Expected on success |
|-----------|--------------|---------------------|
| Typecheck | `pnpm check` | exit 0, no errors   |
| Tests     | `pnpm test:run` | all pass           |

## Scope

**In scope**:
- `src/pages/api/back-in-stock.ts` (SEC-03)
- `src/lib/product/quickViewController.ts` (SEC-04)
- `src/pages/api/create-checkout.ts` (SEC-05)

**Out of scope**:
- `src/lib/email/templates.ts` — the fix is at the storage layer, not the render layer
- `src/lib/product/pdpUI.ts` — already correct, do not change
- `src/lib/backInStock.ts` — `addSubscription` stores what it's given; fix the caller

## Git workflow

- Branch: `advisor/080-security-hardening-bundle`
- Commit: `fix: validate productUrl scheme, encode gallery src, encode cookie value`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Validate productUrl scheme (SEC-03)

In `src/pages/api/back-in-stock.ts`, after line 30 where `productUrl` is read,
add a scheme check:

```typescript
const productUrl = formData.get("product_url")?.toString().trim() ?? "";
// Sanitize: only accept https:// URLs to prevent javascript:/data: href injection
const safeProductUrl = productUrl.startsWith("https://") ? productUrl : "";
```

Then use `safeProductUrl` in place of `productUrl` in the `addSubscription`
call (line ~55):

```typescript
await addSubscription({
  email,
  productId,
  productTitle,
  variationId,
  productUrl: safeProductUrl,
  submittedAt: new Date().toISOString(),
});
```

**Verify**: `pnpm check` → exit 0

### Step 2: Encode src in gallery innerHTML (SEC-04)

In `src/lib/product/quickViewController.ts`, find line 219 and change:

```typescript
// Before:
data-gallery-src="${src}"

// After:
data-gallery-src="${src.replace(/"/g, "&quot;")}"
```

This is the identical pattern already used in `pdpUI.ts:437`. Do not change
any other line.

**Verify**: `pnpm check` → exit 0

### Step 3: Encode orderId in Set-Cookie (SEC-05)

In `src/pages/api/create-checkout.ts`, around line 502, change:

```typescript
// Before:
const cookie = orderId
  ? `square-pending-orderId=${orderId}; Path=/; Max-Age=3600; SameSite=Lax; HttpOnly${import.meta.env.PROD ? "; Secure" : ""}`
  : "";

// After:
const cookie = orderId
  ? `square-pending-orderId=${encodeURIComponent(orderId)}; Path=/; Max-Age=3600; SameSite=Lax; HttpOnly${import.meta.env.PROD ? "; Secure" : ""}`
  : "";
```

`encodeURIComponent` ensures any special characters in `orderId` are percent-encoded
and cannot break the cookie header syntax.

**Verify**: `pnpm check` → exit 0

### Step 4: Run full test suite

```
pnpm test:run
```

**Verify**: all pass; no regressions from the three one-line changes.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `productUrl` in `back-in-stock.ts` is replaced with `safeProductUrl` (blank if not `https://`)
- [ ] `data-gallery-src` in `quickViewController.ts` uses `.replace(/"/g, "&quot;")`
- [ ] `orderId` in `create-checkout.ts` cookie is wrapped in `encodeURIComponent`
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `addSubscription` signature has changed and no longer accepts `productUrl`
- `quickViewController.ts` line 219 no longer uses string interpolation for `data-gallery-src`
- `orderId` cookie has already been switched to use the `ResponseCookies` API

## Maintenance notes

- SEC-03: If the admin email template is later changed to render `productUrl` as a hyperlink via a different code path, ensure the scheme validation propagates or is re-applied at render time.
- SEC-04: Any new `innerHTML` template in `quickViewController.ts` that embeds user-derived strings must use the same `replace` guard.
- SEC-05: Long-term, switch to Astro's built-in `cookies.set()` API which handles encoding automatically.
