# Plan 042: Escape unescaped address and back-in-stock fields in email templates

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/lib/email/templates.ts`
> If any changes appear, compare the "Current state" excerpts before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

Shipping address fields (addressLine1, addressLine2, locality, state, postalCode)
are supplied by the customer during checkout and flow through Square's API back
into the order webhook. They are interpolated directly into email HTML without
`escHtml()`. A customer can inject HTML markup into their own order confirmation
email and into the admin's "New Shipping Order" notification email — the admin
copy being the more sensitive target (convincing phishing link, tracking pixel).

Similarly, back-in-stock `productName` (stored from a user-submitted form field)
is rendered unescaped in the customer-facing BIS email. The existing admin BIS
notification already calls `escHtml(productName)` at line 865 — the customer
email template was missed.

`escHtml()` is already exported from `src/lib/email/templates.ts:57`. This fix
is pure output encoding with no logic changes.

## Current state

**`src/lib/email/templates.ts`** — email HTML builder; `escHtml` defined at line 57.

Order confirmation / shipping address block (lines 298–316):
```typescript
// ~line 298
const addressLines = [
  address?.addressLine1,
  address?.addressLine2,
  address
    ? `${address.locality}, ${address.administrativeDistrictLevel1} ${address.postalCode}`
    : null,
]
  .filter(Boolean)
  .join("<br>");

// ~line 315–316
<strong>${escHtml(contact.name)}</strong><br>
${addressLines || "Address on file"}   // ← NOT escaped
```

Admin shipping notification has an identical pattern around lines 436–498:
```typescript
// ~line 436
const addressLines = [
  address?.addressLine1,
  address?.addressLine2,
  address
    ? `${address.locality}, ${address.administrativeDistrictLevel1} ${address.postalCode}`
    : null,
]
  .filter(Boolean)
  .join("<br>");
// ~line 497–498
<strong>${escHtml(contact.name)}</strong><br>
${addressLines || "Address not captured"}   // ← NOT escaped
```

Back-in-stock customer email (around lines 369, 400, 406):
```typescript
const displayName = variationName ? `${productName} — ${variationName}` : productName;
// ~line 400
${displayName}   // ← NOT escaped
// ~line 406
<a href="${productUrl}"   // ← NOT escaped in href
```

## Commands you will need

| Purpose   | Command              | Expected on success       |
|-----------|----------------------|---------------------------|
| Typecheck | `pnpm check`         | exit 0, no errors         |
| Unit tests | `pnpm test:run`     | all pass                  |
| Coverage  | `pnpm test:coverage` | thresholds pass           |

## Scope

**In scope**:
- `src/lib/email/templates.ts`

**Out of scope**:
- `src/pages/api/back-in-stock.ts` — upstream validation of `productUrl` scheme
  is tracked separately in plan 045; this plan only adds output encoding
- Any test file changes — existing template tests cover the escHtml function;
  no new test cases are required for pure encoding additions

## Git workflow

- Branch: `advisor/042-email-address-html-injection`
- Commit message: `fix: escape address fields and BIS product name in email templates`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Escape address fields in order confirmation email

Open `src/lib/email/templates.ts`. Find the first `addressLines` block (around
line 298) inside the order-confirmation shipping section. Rewrite to apply
`escHtml()` to each field individually before joining:

```typescript
const addressLines = [
  address?.addressLine1 ? escHtml(address.addressLine1) : null,
  address?.addressLine2 ? escHtml(address.addressLine2) : null,
  address
    ? `${escHtml(address.locality)}, ${escHtml(address.administrativeDistrictLevel1)} ${escHtml(address.postalCode)}`
    : null,
]
  .filter(Boolean)
  .join("<br>");
```

The interpolation site `${addressLines || "Address on file"}` at ~line 316 does
NOT need to change — the string is now pre-escaped.

**Verify**: `grep -n "addressLine1\|addressLine2\|locality\|administrativeDistrict\|postalCode" src/lib/email/templates.ts | grep -v escHtml` → only the `address?` in the ternary checks remain; no raw interpolations.

### Step 2: Escape address fields in admin shipping notification email

Find the second `addressLines` block (around line 436) in `buildShippingOrderNotificationHtml`. Apply the same escHtml wrapping as Step 1.

**Verify**: `grep -n "addressLines" src/lib/email/templates.ts` → both occurrences exist and their construction now uses `escHtml()` on every field.

### Step 3: Escape displayName and productUrl in back-in-stock customer email

Find `buildBackInStockHtml` in `src/lib/email/templates.ts`. Around line 369:

```typescript
const firstName = escHtml(customerName.split(" ")[0]);
const displayName = variationName ? `${productName} — ${variationName}` : productName;
```

Change to:
```typescript
const firstName = escHtml(customerName.split(" ")[0]);
const displayName = variationName
  ? `${escHtml(productName)} — ${escHtml(variationName)}`
  : escHtml(productName);
```

Around line 406, the `href="${productUrl}"` must become:
```typescript
<a href="${escHtml(productUrl)}"
```

**Verify**: `grep -n "displayName\|productUrl" src/lib/email/templates.ts` → `displayName` assignment now wraps both parts; `productUrl` in the href is wrapped with `escHtml`.

### Step 4: Typecheck and test

```bash
pnpm check
```
Expected: exit 0, no type errors.

```bash
pnpm test:run
```
Expected: all tests pass (the existing `templates.test.ts` escHtml and formatMoney tests should still pass).

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep -n "address?.addressLine1\b" src/lib/email/templates.ts` → every occurrence is inside an `escHtml(...)` call or an `address?` null-guard producing null
- [ ] `grep -n 'href="${productUrl}"' src/lib/email/templates.ts` → no matches (replaced by `escHtml(productUrl)`)
- [ ] `grep -n '${displayName}' src/lib/email/templates.ts` → no matches (replaced by pre-escaped `displayName` built with `escHtml`)
- [ ] No files outside `src/lib/email/templates.ts` are modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- The address field blocks at the described lines don't match the excerpts —
  compare against live file and adapt, or report back.
- `pnpm check` errors on the `escHtml()` calls (e.g. type mismatch on `string | null`) —
  `escHtml` accepts `string | null | undefined` per its definition at line 57;
  if it doesn't, check the signature and report.
- A test in `templates.test.ts` fails after the change — investigate before
  committing; do not skip or delete tests.

## Maintenance notes

- The `productUrl` encoding in Step 3 only encodes for HTML attribute context.
  URL scheme validation (`javascript:` rejection) is handled upstream in plan 045.
  Both are necessary; neither is sufficient alone.
- If a third email template is added that renders Square-originated address data,
  apply `escHtml()` to every address field inline with construction, not at the
  interpolation site — the join("<br>") pattern makes it easy to miss.
