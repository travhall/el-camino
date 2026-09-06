# Plan 108: Fix broken mailto link interpolation in back-in-stock fallback

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8ff3096..HEAD -- src/components/BackInStock.astro src/components/QuickView.astro`
> If either file changed since this plan was written, compare the "Current
> state" excerpts below against the live file before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `8ff3096`, 2026-08-05

## Why this matters

`src/components/BackInStock.astro:104` and
`src/components/QuickView.astro:274` both render:

```astro
<a href="mailto:{contact.email}" class="underline hover:no-underline">email us directly</a>
```

Astro does not interpolate `{}` inside a quoted HTML attribute string —
that's JSX/Vue syntax, not Astro's. Astro's interpolation replaces the
*entire* attribute value with `{expression}` (no surrounding quotes), or
the value must be a JS expression like a template literal. As written, this
attribute is a **literal string containing the eight characters
`{contact.email}`** — the browser renders an actual `<a>` tag whose `href`
is `mailto:{contact.email}`, which is not a valid mailto URI. A customer
who clicks "email us directly" on this fallback error message gets their
mail client trying to open that literal string as an address, or nothing
happens depending on the browser/OS mail-handler behavior — either way, the
intended support-contact fallback doesn't work.

This is why `contact` shows up as "declared but its value is never read" in
`pnpm check`'s output for both files — the code that looks like it reads
`contact.email` never actually executes as an expression; it's dead text
inside a string. This is a correctness bug hiding behind what looked like a
harmless unused-variable hint (see `plans/107-remove-dead-astro-declarations.md`,
which explicitly excludes these two sites for this reason — do not let a
future dead-code pass delete `contact` here instead of fixing the
interpolation).

Both occurrences are inside the fallback "Something went wrong" error state
of the back-in-stock signup form (shown only when the client-side AJAX
submission fails), so this is a low-traffic path — but it's the exact path
a frustrated customer hits, and the fix is a one-line syntax correction per
file.

## Current state

- `src/components/BackInStock.astro:23-24` — `contact` is fetched at the
  top of the component:
  ```astro
  import { getContactInfo } from "@/lib/contactInfo";
  const contact = await getContactInfo();
  ```
  `src/components/BackInStock.astro:102-105` — the broken markup:
  ```astro
    Something went wrong — please try again or <a
      href="mailto:{contact.email}"
      class="underline hover:no-underline">email us directly</a
    >.
  ```

- `src/components/QuickView.astro:9-10` — same fetch pattern:
  ```astro
  import { getContactInfo } from "@/lib/contactInfo";
  const contact = await getContactInfo();
  ```
  `src/components/QuickView.astro:272-276` — the broken markup:
  ```astro
              Something went wrong — please try again or <a
                href="mailto:{contact.email}"
                class="underline hover:no-underline">email us directly</a
              >.
  ```

- `src/lib/contactInfo.ts`'s `getContactInfo()` return shape — confirm the
  `email` field name and that it's a plain string (not already prefixed
  with `mailto:`) before editing, e.g. `grep -n "email" src/lib/contactInfo.ts`.
  Existing correct usage of a similar pattern elsewhere in the codebase can
  be used as a style reference if one exists — search for other
  `href={` mailto/tel patterns with `grep -rn "href={\`mailto:" src` or
  `grep -rn "href={\`tel:" src` before picking a style; if none exist, use
  the template-literal form below, which is Astro's standard idiom for a
  string attribute built from an expression.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|----------------------|
| Typecheck | `pnpm check`     | exit 0, "0 errors"; the `contact` unused hint disappears for both files |
| Lint      | `pnpm lint`      | exit 0 |
| Build     | `pnpm build`     | exit 0 |
| Tests     | `pnpm test:run`  | all pass |

## Scope

**In scope** (the only files you should modify):
- `src/components/BackInStock.astro`
- `src/components/QuickView.astro`

**Out of scope** (do NOT touch, even though they look related):
- `src/lib/contactInfo.ts` — read-only reference for the `email` field
  shape, do not modify.
- Anything else in either file, including the unrelated
  `EL_CAMINO_LOGO_DATA_URI` unused import in `QuickView.astro:7` — that's
  `plans/107-remove-dead-astro-declarations.md`'s job, not this plan's.
- The success-state markup (`✓ You're on the list!...`) directly above the
  broken line in both files — unrelated, don't touch.

## Git workflow

- Branch: `advisor/108-fix-broken-mailto-interpolation`
- Commit message style: conventional commits, e.g. `fix: correct broken
  mailto link interpolation in back-in-stock fallback` (matches
  `9c64499 fix: await updateQuantity in cart undo and add pickup open-hours
  guard` in `git log`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the interpolation in `BackInStock.astro`

Replace the broken attribute at line 104:

```astro
      href="mailto:{contact.email}"
```

with a template-literal expression (no surrounding quotes on the attribute,
since `{}` now holds the whole value):

```astro
      href={`mailto:${contact.email}`}
```

**Verify**: `grep -n 'href={\`mailto:' src/components/BackInStock.astro` → 1 match. `grep -n 'href="mailto:{contact' src/components/BackInStock.astro` → no matches.

### Step 2: Fix the interpolation in `QuickView.astro`

Same fix at line 274:

```astro
                href="mailto:{contact.email}"
```

becomes:

```astro
                href={`mailto:${contact.email}`}
```

**Verify**: `grep -n 'href={\`mailto:' src/components/QuickView.astro` → 1 match. `grep -n 'href="mailto:{contact' src/components/QuickView.astro` → no matches.

### Step 3: Confirm the unused-var hint clears

**Verify**: `pnpm check 2>&1 | grep -c "'contact' is declared but its value is never read"` → 0 (was 2 before this plan).

## Test plan

No existing automated test renders this fallback error state (it's
conditionally shown by client-side JS on a failed fetch, not exercised by
the current unit/component test suite based on a search of
`src/components/__tests__/` for `BackInStock`/`QuickView` — confirm this
assumption still holds by running `find src -iname "*backinstock*" -o
-iname "*quickview*" | grep -i test` before concluding no test needs
updating). If a relevant test does exist, it should still pass unchanged
(the fix only corrects the string value assembly, not the DOM structure or
conditional-display logic). No new test is required for this fix given its
size — visually verify by triggering the fallback state if the executor has
browser-preview tooling available (temporarily force the error branch to
display, confirm the rendered `<a href>` in devtools resolves to
`mailto:` + an actual email address, then revert the temporary force).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0, "0 errors"
- [ ] `pnpm check 2>&1 | grep -c "'contact' is declared but its value is never read"` → 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] `pnpm test:run` exits 0, same pass count as before this plan
- [ ] Both "Verify" greps in Steps 1 and 2 pass
- [ ] No files outside `src/components/BackInStock.astro` and
      `src/components/QuickView.astro` are modified (`git status`)
- [ ] `plans/README.md` status row for 108 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `getContactInfo()`'s return shape doesn't have an `email` field matching
  what's read here (`contact.email`) — re-check `src/lib/contactInfo.ts`
  before assuming the fix above is complete; if the field is named
  differently or nested, the fix must match the real shape, and this plan's
  "Current state" was wrong.
- The two lines don't match the excerpts above (drift since this plan was
  written) — re-read the live file and adjust, but do not deviate from the
  core fix (replace string-embedded `{}` with a proper `{`\`...\`}`
  expression) without reporting back first.

## Maintenance notes

- This is the same failure mode wherever it recurs: `href="...{expr}..."`
  inside an Astro component's template is never valid interpolation — a
  reviewer seeing this pattern anywhere else in a future PR should flag it
  immediately, since it will silently ship a broken attribute exactly like
  this one did (a `grep -rn '="[a-zA-Z:/]*{[a-zA-Z]' src --include="*.astro"`
  was run repo-wide during this plan's investigation and found no other
  instances — but re-check if this pattern resurfaces).
- No new test coverage is added by this plan (see Test plan) — if this
  component ever gets meaningful component-level tests, asserting the
  fallback link's `href` starts with `mailto:` and contains `@` would catch
  a regression of this exact bug.
