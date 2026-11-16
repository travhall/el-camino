# Plan 035: Escape user-controlled HTML in transactional email templates

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0da82aa..HEAD -- src/lib/email/templates.ts src/pages/api/back-in-stock.ts`
> If either file changed since this plan was written, compare the "Current state"
> excerpts before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `0da82aa`, 2026-07-22

## Why this matters

Transactional email templates in `src/lib/email/templates.ts` interpolate
user-controlled strings directly into HTML without escaping. The most
exploitable instance: a pickup order's customer notes field (`customerNotes`,
extracted from the Square pickup-note via regex at `templates.ts:645-646`) and
a back-in-stock subscriber's product name (`productName`, sourced from a
raw form field in `back-in-stock.ts:28`) are both injected verbatim into the
admin notification email HTML.

An attacker can submit a pickup order with pickup notes containing
`<a href="https://attacker.example/">Click here to confirm pickup</a>` and that
anchor renders in the shop owner's inbox as a clickable phishing link. The fix
is a tiny pure utility function applied at every interpolation point.

## Current state

**Files involved**:
- `src/lib/email/templates.ts` — HTML email template builders; 893 lines
- `src/pages/api/back-in-stock.ts` — stores raw `product_title` form field without length cap

**Vulnerable interpolation points in `templates.ts`** (confirm against live file):

```typescript
// ~line 240: first name from customer contact
Thanks, ${contact.name.split(" ")[0]}!

// ~line 689: customer pickup notes interpolated into admin notification
${customerNotes
  ? `<p style="..."><strong>Customer note:</strong> ${customerNotes}</p>`
  : ""}

// ~line 855: back-in-stock subscriber email and product name
${subscriberEmail}
${productName}
```

The `contact.name` field comes from Square's checkout API (set from the customer's
form input). `customerNotes` is extracted from the Square pickup fulfillment note
field. `subscriberEmail` and `productName` come directly from the public
back-in-stock POST form.

**Existing helpers in `templates.ts`** (at the top of the file, lines 1-55):

```typescript
// Already-present pure helpers (use these as a pattern for the new one):
function formatMoney(amount: bigint | number | undefined | null): string { ... }
function shortOrderId(orderId: string): string { ... }
function formatPickupTime(isoString: string): string { ... }
```

## Commands you will need

| Purpose   | Command        | Expected on success       |
|-----------|----------------|---------------------------|
| Typecheck | `pnpm check`   | exit 0, no errors         |
| Unit tests | `pnpm test:run` | all pass                 |

## Scope

**In scope**:
- `src/lib/email/templates.ts` — add `escHtml()` helper; wrap every user-controlled interpolation

**Out of scope**:
- `src/lib/email/sender.ts` — no HTML interpolation happens there
- `src/pages/api/back-in-stock.ts` — the data is stored to Blobs before templates.ts ever sees it; escaping at the template layer is the right fix
- WordPress content rendered via `set:html` in Astro components — covered by a separate settled decision (WordPress is a trusted CMS)

## Git workflow

- Branch: `advisor/035-fix-email-html-injection`
- Commit message style: `fix: escape user-controlled strings in email templates`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add the `escHtml` helper to templates.ts

At the top of `src/lib/email/templates.ts`, immediately after the existing helper
functions (after the `formatPickupTime` function, roughly line 55), add:

```typescript
function escHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

This covers all five HTML metacharacters. No external library needed.

**Verify**: `grep -n 'function escHtml' src/lib/email/templates.ts` → prints the new function line

### Step 2: Wrap all user-controlled interpolations with escHtml()

Search the file for every place where a user-controlled value is interpolated into
an HTML string. The full list to change:

**All occurrences of `contact.name`** (approximately lines 240, 305, 462, 487, 554, 674):
```typescript
// Before:
${contact.name.split(" ")[0]}
${contact.name}

// After:
${escHtml(contact.name).split(" ")[0]}   // first-name split — note: split AFTER escaping
${escHtml(contact.name)}
```

Wait — splitting after escaping is wrong for `split(" ")`. The correct approach:
```typescript
// Before:
${contact.name.split(" ")[0]}

// After:
${escHtml(contact.name.split(" ")[0])}
```

Apply this pattern consistently:
- Every `${contact.name}` → `${escHtml(contact.name)}`
- Every `${contact.name.split(" ")[0]}` → `${escHtml(contact.name.split(" ")[0])}`

**`customerNotes`** (around line 689):
```typescript
// Before:
${customerNotes
  ? `<p style="margin:0;font-size:13px;color:#2b2215;"><strong>Customer note:</strong> ${customerNotes}</p>`
  : ""}

// After:
${customerNotes
  ? `<p style="margin:0;font-size:13px;color:#2b2215;"><strong>Customer note:</strong> ${escHtml(customerNotes)}</p>`
  : ""}
```

**`subscriberEmail` and `productName`** in back-in-stock admin notification (around lines 836–872):
```typescript
// Before:
${subscriberEmail}
${productName}

// After:
${escHtml(subscriberEmail)}
${escHtml(productName)}
```

**Tip**: Run `grep -n '\${contact\.name\|customerNotes\|subscriberEmail\|productName' src/lib/email/templates.ts`
to find all interpolation sites before making changes.

**Verify**: After all changes, run the grep again and confirm every hit is now wrapped in `escHtml(...)`.

### Step 3: Typecheck

**Verify**: `pnpm check` → exit 0, no TypeScript errors

### Step 4: Run tests

**Verify**: `pnpm test:run` → all tests pass (no tests currently cover templates.ts —
this step confirms no regressions in other modules)

## Test plan

Add a new test file `src/lib/email/templates.test.ts` that covers the `escHtml`
function and the pure helper functions. (This is a subset of what Plan 039 will
do for full email coverage — Plan 039 can be skipped for the helpers if this
plan already covers them.)

Minimum tests for this plan:
```typescript
// escHtml escapes all five metacharacters
it("escHtml: escapes < > & \" '", () => {
  expect(escHtml('<script>alert("xss")&nbsp;</script>')).toBe(
    '&lt;script&gt;alert(&quot;xss&quot;)&amp;nbsp;&lt;/script&gt;'
  );
});
it("escHtml: returns empty string for null/undefined", () => {
  expect(escHtml(null)).toBe("");
  expect(escHtml(undefined)).toBe("");
});
```

Because `escHtml` is a module-private function, you'll need to either export it
(add `export` keyword, which is fine for testing) or test it indirectly via the
template builder functions. Prefer exporting it — it may be useful in Plan 039.

**Verify**: `pnpm test:run -- --reporter=verbose` shows the new tests passing.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep -n '\${contact\.name[^)]' src/lib/email/templates.ts` → no output (all wrapped)
- [ ] `grep -n '\${customerNotes}' src/lib/email/templates.ts` → no output
- [ ] `grep -n '\${subscriberEmail}' src/lib/email/templates.ts` → no output
- [ ] `grep -n '\${productName}' src/lib/email/templates.ts` → no output
- [ ] `escHtml` helper exists in `templates.ts`
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row for 035 updated to DONE

## STOP conditions

- The interpolation sites don't match the locations described above (file has changed).
- `pnpm check` fails after adding `escHtml` — likely a module export issue; report.
- Any template builder function has a user-controlled string being interpolated into
  an HTML attribute value (e.g., `href="${someValue}"`) — attribute injection requires
  a slightly different escaping approach; stop and report rather than guessing.

## Maintenance notes

- Every new template function added to `templates.ts` that interpolates any
  user-originated string must call `escHtml()` on that value.
- Static strings in templates (hex colors, CSS values, hard-coded labels) do not
  need `escHtml()` — only apply it to values sourced from Square API responses,
  form submissions, or stored contact/order data.
- `contact.email` is typically rendered in `href="mailto:..."` or `to:` fields,
  not raw HTML body — if it ever appears in HTML body text, wrap it too.
