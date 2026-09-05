# Plan 066: Escape contact.email in admin notification email templates

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/lib/email/templates.ts`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness (also security)
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

`src/lib/email/templates.ts` builds HTML email bodies using string
interpolation. Two admin notification templates (new order and "back in
stock" admin alert) interpolate `contact.email` directly into anchor tags:

- Line 477: `` `<a href="mailto:${contact.email}">${contact.email}</a>` ``
- Line 689: `` `<a href="mailto:${contact.email}">${contact.email}</a>` ``

If a customer submits an email address containing `<`, `>`, or `"` characters,
the resulting admin notification email will contain malformed HTML. While the
delivery domain (Resend) may strip some of this, any content reaching the admin
email client could render as HTML — an XSS risk in the email client context.

`contact.name` (same templates) is already wrapped in `escHtml()`. Wrapping
`contact.email` in the same helper closes the gap.

Note: `href="mailto:${contact.email}"` should also be sanitized, but email
addresses with valid HTML-injectable characters (`"`, `<`) are rejected by most
MUA parsers, so the href change is a secondary concern — address the text
content first.

## Current state

`src/lib/email/templates.ts:477`:

```ts
<a href="mailto:${contact.email}" style="...">${contact.email}</a>
```

`src/lib/email/templates.ts:689`:

```ts
<a href="mailto:${contact.email}" style="...">${contact.email}</a>
```

`escHtml` is already imported and used in this file (e.g. `escHtml(contact.name)`).

## Commands you will need

| Purpose        | Command              | Expected on success      |
|----------------|----------------------|--------------------------|
| Find targets   | `grep -n "contact.email" src/lib/email/templates.ts` | shows lines to fix |
| Typecheck      | `pnpm check`         | exit 0, no errors        |
| Unit tests     | `pnpm test:run`      | all pass                 |

## Scope

**In scope**:
- `src/lib/email/templates.ts` — the two occurrences of `${contact.email}` in
  HTML text nodes (NOT in `href` attributes — leave those unchanged for now)

**Out of scope**:
- `siteConfig.contact.email` at line 133 — that is static site configuration,
  not user-supplied input; leave as-is
- `href="mailto:${contact.email}"` — a separate concern; not in scope
- Any other template file

## Git workflow

- Branch: `advisor/066-escape-contact-email-templates`
- Commit message: `fix: escape contact.email in HTML text nodes of admin email templates`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Locate the occurrences

```bash
grep -n "contact\.email" src/lib/email/templates.ts
```

Expected: at least three matches (line 133 for site config, lines ~477 and ~689
for admin notifications). Confirm `escHtml` is imported at the top of the file:

```bash
grep -n "escHtml" src/lib/email/templates.ts | head -5
```

### Step 2: Wrap the text-node occurrences

For each admin notification template occurrence (lines ~477 and ~689), change
the text node interpolation:

```ts
// Before
>${contact.email}</a>

// After
>${escHtml(contact.email)}</a>
```

Do NOT change the `href="mailto:..."` attribute.

**Verify**:

```bash
grep -n "escHtml(contact.email)" src/lib/email/templates.ts
```

Expected: 2 matches.

### Step 3: Typecheck and test

```bash
pnpm check
```

Expected: exit 0.

```bash
pnpm test:run
```

Expected: all pass. If sender tests assert the exact HTML output and break
because `escHtml()` wraps the value, update the test's expected string to
include the escaped form — this is the correct behavior.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep -n ">\${contact.email}<" src/lib/email/templates.ts` → zero matches
  (text nodes are now wrapped in `escHtml`)
- [ ] `grep -n "escHtml(contact.email)" src/lib/email/templates.ts` → 2 matches
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `escHtml` is not imported in `templates.ts` — check the import at the top;
  if missing, add it from wherever it is defined (likely `"@/lib/email/utils"`
  or inline in the file).
- The function signature of `escHtml` does not accept `string | undefined` and
  `contact.email` can be undefined — add a null-coalescing fallback:
  `escHtml(contact.email ?? "")`.
