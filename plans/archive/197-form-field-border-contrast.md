# Plan 197: Full-strength borders on form fields, steppers and variant selectors (finish the 3:1 fix)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If a STOP condition occurs, stop and report — do not improvise. When done, report the outcome in your final message; do NOT edit `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1ca06c0..HEAD -- src/components src/lib/product src/pages src/styles/global.css`. Compare any changed in-scope file against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW-MED (visible styling change to controls)
- **Depends on**: plan 194 (merged: `contrast.test.ts` + light `--ui-input-border` now `sweet-tea-500`, 5.19:1 on `--surface-primary`)
- **Category**: bug (accessibility)
- **Planned at**: commit `1ca06c0`, 2026-09-27

## Why this matters

Plan 194 fixed the `--ui-input-border` token (was 2.64:1, now 5.19:1) but 31 call sites apply it as `border-(--ui-input-border)/50` (50% alpha), which composites to only ~2.06:1 on beeswax-100 — still under the WCAG 1.4.11 3:1 minimum for the visible boundary of a form control. For text fields and steppers the border is the only thing that marks the control, so those must be full strength. Tag/filter chips identified by their text are not required to have a 3:1 border and are left alone (a deliberate, documented decision — do not "fix" them).

## Current state — the 31 sites, classified

Verify the list yourself with `grep -rn "ui-input-border)/50" src`.

**Tier 1 — form fields & steppers: remove `/50` (≈11 sites)**
- `src/components/BackInStock.astro:80` (email input)
- `src/components/NewsSearchSort.astro:28` (search input), `:82` (sort select), `:102` (view-toggle group border)
- `src/components/QuickView.astro:160`, `:165`, `:180` (quantity stepper), `:250` (input)
- `src/pages/product/[id].astro:886`, `:890`, `:906` (quantity stepper)

**Tier 2 — variant selector chips (primary purchase control; unselected state is border-only): remove `/50` (≈8 sites)**
- `src/lib/product/pdpUI.ts:352, 369, 394, 405` — these are `classList.add/remove('border-(--ui-input-border)/50')` pairs toggling selected vs unselected; the string must stay identical in each add/remove pair
- `src/lib/product/quickViewController.ts:334, 689` (class strings)
- `src/pages/product/[id].astro:756, 855` (variant chip class strings)

**Tier 3 — leave unchanged (≈12 sites, text-identified pills/tags/links):** `AppliedFilters.astro` (5), `RelatedProducts.astro:51`, `category/[...slug].astro:205,219`, `news/[slug].astro:360`, `news/tag/[slug].astro:106`, `the-shop/index.astro:536,564`.

Conventions: Tailwind v4 arbitrary-var classes; full-strength is `border-(--ui-input-border)` (no opacity suffix). Selected variants use `border-(--ui-variant-selected-border)` — don't touch. Tests may assert class strings: grep `src/**/__tests__` for `ui-input-border` before editing and update assertions to match, not the reverse.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `pnpm check` | 0 errors |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test:run` | all pass |
| Coverage | `pnpm test:coverage` | exit 0 |

## Scope

**In scope**: only the Tier 1 and Tier 2 files/lines above, plus any test whose class-string assertion must change.
**Out of scope**: Tier 3 sites; `global.css` and every token value; the `contrast.test.ts` file; `/50` used on *other* tokens or on backgrounds/placeholders (e.g. `bg-(--surface-primary)/50`, `placeholder:text-(--content-meta)/50`) — only `border-(--ui-input-border)/50` is targeted.

## Git workflow

Branch `advisor/197-form-field-border-contrast`; conventional commits (`fix(a11y): full-strength borders on form fields`, `fix(a11y): full-strength borders on variant selectors`). Do NOT push or open a PR.

## Steps

### Step 1: Tier 1
Replace `border-(--ui-input-border)/50` with `border-(--ui-input-border)` at each Tier 1 site (also `border-r`/`border-l`/`border` variants — keep the direction utility, drop only the `/50`).
**Verify**: `grep -n "ui-input-border)/50" src/components/BackInStock.astro src/components/NewsSearchSort.astro src/components/QuickView.astro` → no output; `pnpm check` → 0 errors.

### Step 2: Tier 2
Same replacement for the Tier 2 sites. In `pdpUI.ts`, change all four occurrences consistently so remove/add pairs still cancel.
**Verify**: `grep -n "ui-input-border)/50" src/lib/product/pdpUI.ts src/lib/product/quickViewController.ts` → no output; `pnpm test:run` → all pass (update class-string assertions if any fail, and say so in your report).

### Step 3: Confirm the remaining set is exactly Tier 3
**Verify**: `grep -rln "ui-input-border)/50" src` → exactly these files: `AppliedFilters.astro`, `RelatedProducts.astro`, `category/[...slug].astro`, `news/[slug].astro`, `news/tag/[slug].astro`, `the-shop/index.astro`.

### Step 4: Visual check (required)
Run `pnpm dev`; view in light and dark theme: a PDP's size/colour chips and quantity stepper (needs Square data — if unavailable, check the news search bar on `/news` and the QuickView stepper only, and say which pages you could not view), `/news` search + sort. Confirm chips still read as clearly selected vs unselected and borders aren't heavy enough to look broken. If the unselected chip border looks too heavy on the PDP, STOP and report with a description rather than picking a new alpha.

## Test plan

No new test file: the existing suite plus `contrast.test.ts` cover token values. Optionally add one vitest assertion in the nearest existing pdpUI test that unselected variant buttons carry `border-(--ui-input-border)` and not the `/50` variant, if the file already asserts classes.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test:run`, `pnpm test:coverage` exit 0
- [ ] Step 3's grep returns exactly the six Tier 3 files
- [ ] `git status` shows only Tier 1/2 files (+ tests) changed
- [ ] Visual check reported

## STOP conditions

- A listed line no longer matches (drift) or a site's role is unclear (control vs decoration) — report it, don't guess.
- Unselected chips look too heavy (Step 4).
- More than ~4 tests need class-assertion rewrites — report the list.

## Maintenance notes

- Rule going forward: **borders that are the only boundary of an input/stepper/selector use `border-(--ui-input-border)` at full strength; decorative or text-identified pills may be lighter.** Consider a code comment near the token in `global.css` (out of scope here).
- Reviewer: check dark theme too — there `--ui-input-border` is `--content-body`, already high contrast.
