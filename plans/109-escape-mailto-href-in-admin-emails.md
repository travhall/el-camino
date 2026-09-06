# Plan 109: Escape customer email in admin notification email mailto hrefs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8ff3096..HEAD -- src/lib/email/templates.ts src/pages/api/create-checkout.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts below against the live file before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `8ff3096`, 2026-08-06

## Why this matters

`src/lib/email/templates.ts` builds the HTML emails sent to the shop's admin
(Tyler) whenever a customer places a pickup or shipping order. Two of those
templates interpolate the customer-supplied email address directly into an
`href` attribute without escaping:

```html
<a href="mailto:${contact.email}" ...>${escHtml(contact.email)}</a>
```

The **visible text** is escaped (`escHtml(contact.email)`), but the `href`
attribute is not. `contact.email` originates from `shippingAddress.email` /
`pickupContact.email` in the public checkout request body
(`src/pages/api/create-checkout.ts`), and **nothing in that route validates
the field's format** — it's typed as `email: string` and passed straight
through to Square's `checkout.paymentLinks.create()` and into the stored
pending-order contact info that these email templates later read. Compare
`src/pages/api/back-in-stock.ts:34`, a different, unrelated form on this
site, which does validate its email field with a regex before accepting it —
`create-checkout.ts` has no equivalent gate.

This is a real HTML/attribute-injection vector into a trusted-recipient
inbox: a checkout submission with a crafted email value containing `"` and
`>` characters can inject arbitrary markup or rewrite the link's
destination in the HTML email Resend delivers to the shop admin for every
order. The rest of this same file consistently escapes attribute values
built from user input — e.g. `src/lib/email/templates.ts:411`,
`` <a href="${escHtml(productUrl)}" ``  — so the two unescaped `mailto:`
lines are an inconsistency with the file's own established pattern, not a
deliberate choice.

A related but distinct bug (a broken Astro-template `mailto:` interpolation
in two `.astro` *component* files, not these email templates) is fixed by
`plans/108-fix-broken-mailto-interpolation.md` — that plan is unrelated to
this one; do not conflate them.

## Current state

- `src/lib/email/templates.ts:482` (inside the shipping-order admin
  notification template):
  ```html
          <tr>
            <td style="font-size:14px;color:#4f3d22;padding-bottom:4px;">Email</td>
            <td style="font-size:14px;color:#2b2215;padding-bottom:4px;">
              <a href="mailto:${contact.email}" style="color:#4d7a2e;text-decoration:none;">${escHtml(contact.email)}</a>
            </td>
          </tr>
  ```
- `src/lib/email/templates.ts:696` (inside the pickup-order admin
  notification template) — identical markup, same fix.
- `src/lib/email/templates.ts:59-64` — the existing `escHtml` helper already
  used everywhere else in this file:
  ```ts
  export function escHtml(str: string | null | undefined): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  ```
  (the function continues beyond what's shown — do not modify it, just call
  it at the two sites above).
- `src/lib/email/templates.ts:411` — the established pattern to match:
  `` <a href="${escHtml(productUrl)}" `` — confirms attribute-position
  interpolations in this file are expected to be escaped.
- `src/pages/api/create-checkout.ts:168-183` — the two interfaces whose
  `email` field flows unvalidated into the pending-order contact record
  read by the templates above:
  ```ts
  interface ShippingAddress {
    name: string;
    email: string;
    phone: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    instructions?: string;
  }

  interface PickupContact {
    name: string;
    email: string;
    phone: string;
    notes?: string;
  }
  ```
- `src/pages/api/back-in-stock.ts:34` — the validation pattern that exists
  on a *different* form but not on checkout: `` !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ``.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|----------------------|
| Typecheck | `pnpm check`     | exit 0, "0 errors" |
| Tests     | `pnpm test:run`  | all pass, including new tests from this plan |
| Coverage  | `pnpm test:coverage` | exits 0; `src/lib/email/templates.ts` is not one of the per-file thresholded modules in `vitest.config.ts` (only `src/lib/cart/index.ts`, `src/lib/square/apiRetry.ts`, `src/lib/square/inventory.ts` are), so the 80% global threshold is what applies |
| Lint      | `pnpm lint`      | exit 0 |
| Build     | `pnpm build`     | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/lib/email/templates.ts`
- `src/lib/email/__tests__/templates.test.ts` (add cases; file already
  exists per `git log`/repo structure — confirm with
  `find src/lib/email -iname "*templates*test*"` and adjust the path above
  if it's named differently)

**Out of scope** (do NOT touch, even though they look related):
- `src/pages/api/create-checkout.ts` — adding email-format validation there
  is a reasonable defense-in-depth follow-up but is a separate, larger
  change (touches the public checkout API contract and its own test
  suite). This plan's fix (escaping the attribute) is sufficient on its own
  to close the injection vector regardless of what the email field
  contains — do not expand scope into checkout validation.
- `src/components/BackInStock.astro` / `src/components/QuickView.astro` —
  that's `plans/108-fix-broken-mailto-interpolation.md`, a different bug in
  different files.
- `escHtml()`'s own implementation — already correct, just call it.

## Git workflow

- Branch: `advisor/109-escape-mailto-href-in-admin-emails`
- Commit message style: conventional commits, e.g. `fix: escape customer
  email in admin notification email mailto hrefs` (matches
  `28d7b68 fix: validate productUrl scheme, encode gallery src, encode
  cookie value` in `git log`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Escape the `href` at line 482

Change:
```html
<a href="mailto:${contact.email}" style="color:#4d7a2e;text-decoration:none;">${escHtml(contact.email)}</a>
```
to:
```html
<a href="mailto:${escHtml(contact.email)}" style="color:#4d7a2e;text-decoration:none;">${escHtml(contact.email)}</a>
```

**Verify**: `grep -n 'href="mailto:\${contact.email}"' src/lib/email/templates.ts` → no matches (both sites fixed after Step 2).

### Step 2: Escape the `href` at line 696

Same fix, same template literal shape, at the pickup-order template.

**Verify**: `grep -c 'href="mailto:\${escHtml(contact.email)}"' src/lib/email/templates.ts` → 2.

### Step 3: Add regression tests

Find the existing test file for this module (`find src/lib/email -iname
"*templates*test*"`) and add test cases asserting that when `contact.email`
contains HTML-special characters (e.g. a value like
`` x"><script>alert(1)</script>@example.com `` used only as a test fixture,
never a real address), the rendered HTML for both the shipping- and
pickup-order admin templates contains the *escaped* form
(`&quot;`/`&lt;`/`&gt;`) inside the `href="mailto:...."` attribute and does
**not** contain a raw unescaped `"` or `<` character breaking out of the
attribute. Model the test structure after whatever existing tests in that
file already assert on rendered template output (e.g. existing assertions
around `escHtml(contact.name)` if present).

**Verify**: `pnpm test:run` → all pass, including the new cases.

## Test plan

- New tests in the templates test file: one case per template
  (shipping-order admin notification, pickup-order admin notification)
  feeding a `contact.email` value containing `"`, `<`, `>` and asserting the
  rendered output's `href` attribute is fully escaped and doesn't terminate
  early.
- Model after whatever pattern the existing test file already uses to
  render a template and assert on its HTML output (read the file first —
  do not guess the harness shape).
- Verification: `pnpm test:run` → all pass, new tests included.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0, "0 errors"
- [ ] `pnpm test:run` exits 0, new tests present and passing
- [ ] `pnpm test:coverage` exits 0 (global threshold still met)
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -c 'href="mailto:\${escHtml(contact.email)}"' src/lib/email/templates.ts` → 2
- [ ] `grep -n 'href="mailto:\${contact.email}"' src/lib/email/templates.ts` → no matches
- [ ] No files outside the Scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 109 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Either line's content doesn't match the excerpt above (drift since this
  plan was written) — re-read the live file and confirm the same
  unescaped-attribute pattern is present before applying the fix; if the
  code has already been fixed by something else, mark this plan DONE with a
  note rather than re-applying.
- No test file exists yet for `src/lib/email/templates.ts` at all (the
  `find` in Step 3 returns nothing) — in that case, add the two regression
  tests to a new minimal test file rather than skipping them, but report
  back before doing so since it changes this plan's footprint slightly
  beyond what "Scope" describes.

## Maintenance notes

- A reviewer should scrutinize: that both occurrences were fixed (there are
  exactly 2 in the file today — confirm the count didn't change if the
  file has other `mailto:` uses added later).
- This is the same class of gap as `plans/108-...` (an unescaped/
  mis-escaped `mailto:` construction) but in a different rendering context
  (server-built HTML email string vs. Astro template attribute) with a
  different, unrelated root cause — worth a reviewer noting both exist so
  future `mailto:` additions in this codebase get scrutinized either way.
- Defense-in-depth follow-up not included here: `create-checkout.ts` has no
  email-format validation on `shippingAddress.email`/`pickupContact.email`.
  This plan's fix (escaping on render) closes the injection vector
  regardless, but a future plan could add input validation at the API
  boundary too, matching `back-in-stock.ts`'s existing pattern.
