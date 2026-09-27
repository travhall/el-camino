# Plan 208: Fix h1→h3 heading-level skip in the PDP's unstructured-variation fallback block

> **Executor instructions**: Follow step by step; run the verification command; on any STOP condition stop and report. Do NOT edit `plans/README.md`; report the outcome in your final message. **This is a markup-only change** — confirmed in advance that no CSS in this repo selects `h3` or `h2` by bare tag name in a way that would change this element's appearance (see "Why h2 is safe" below); if you find evidence otherwise, STOP rather than proceeding.
>
> **Drift check (run first)**: `git diff --stat 45060e2..HEAD -- src/pages/product/\[id\].astro` — on a mismatch, re-read the excerpt below before proceeding.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (single tag-name change, one element)
- **Depends on**: none
- **Category**: tech-debt (accessibility)
- **Planned at**: commit `45060e2`, 2026-09-27

## Why this matters

The PDP's product-info column has exactly one `<h1>` (the product title). One fallback rendering branch — used only when a variation's name is completely unparseable into attributes (see "Current state") — renders a heading that jumps straight to `<h3>`, skipping `<h2>`. Screen-reader users navigating by heading level see a level skip with nothing to indicate what was skipped, which is a WCAG 1.3.1/2.4.6-adjacent structural issue even though the page renders and reads fine visually. The maintainer confirmed this is worth fixing and asked whether it's a markup-only change — it is: this repo styles headings entirely through Tailwind utility classes applied per-element (`class="text-sm font-medium text-(--content-heading) mb-2"` on this specific element) plus one global rule that applies identically to `h1`-`h6` (`text-wrap: balance`, `src/styles/global.css:423-430`). There is no CSS selector in this codebase (`h3 { ... }`, `.foo h3`, etc., outside the shared `h1,h2,...,h6` rule and the unrelated `.wp-content-block h1/h2/h3` blog-content rules) that depends on this element specifically being an `h3`. Changing the tag to `h2` is a pure DOM/semantics change.

## Current state

`src/pages/product/[id].astro:838-844` — the fallback branch, rendered only when `hasMultipleVariations && attributeTypes.length === 0` (i.e. `parseVariationName` returned an empty attributes object for every variation — which happens only for empty/whitespace-only variation names; this is a distinct, rarer code path from the `attributeTypes.length === 1` / generic-"Option" case that plan 207 addresses — don't conflate the two):

```astro
<!-- Fallback: Standard Variation Selection (for variations that don't have structured attributes) -->
{
  hasMultipleVariations && attributeTypes.length === 0 && (
    <div class="mt-6">
      <h3 class="text-sm font-medium text-(--content-heading) mb-2">
        Options
      </h3>
      <div id="variation-buttons" class="flex flex-wrap gap-2">
        {variations.map((variation) => (
          ...
        ))}
      </div>
    </div>
  )
}
```

## Why h2 is safe (verified this session, don't re-derive — just confirm the file state still matches)

`src/styles/global.css:423-430`:
```css
h1,
h2,
h3,
h4,
h5,
h6 {
  text-wrap: balance;
}
```
This is the only bare-tag heading rule in the file that isn't scoped to `.wp-content-block` (WordPress blog content, unrelated to this page). It applies the identical declaration to every heading level, so `h3` → `h2` changes nothing about how this element renders.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `pnpm check` | 0 errors |
| Lint | `pnpm lint` | exit 0 |

## Scope

**In scope**: `src/pages/product/[id].astro`, line 842 only (the opening and closing tag of that one `<h3>`).

**Out of scope**: every other heading on this page or elsewhere in the codebase; the `class` attribute on this element (leave it exactly as-is); the "Options" text content; the sibling fallback branches (`lines 705-836`) that use `<span>`, not a heading, for their labels — do not "upgrade" those to headings, they're correctly non-heading labels for chip groups, not this plan's concern.

## Git workflow

Branch `advisor/208-fix-fallback-heading-hierarchy`; conventional commit (e.g. `fix: correct h3->h2 heading skip in PDP unstructured-variant fallback`). Do NOT push or open a PR.

## Steps

### Step 1: Change the tag

In `src/pages/product/[id].astro:842-844`, change:
```astro
<h3 class="text-sm font-medium text-(--content-heading) mb-2">
  Options
</h3>
```
to:
```astro
<h2 class="text-sm font-medium text-(--content-heading) mb-2">
  Options
</h2>
```
Both opening and closing tags. Nothing else on those lines changes.

**Verify**: `pnpm check` → 0 errors; `grep -n "Options" src/pages/product/\[id\].astro` locates the line — confirm by eye it now reads `<h2 ...>` before it.

### Step 2: Gates

**Verify**: `pnpm check` and `pnpm lint` exit 0; `git diff src/pages/product/\[id\].astro` shows exactly a 2-line change (open tag, close tag), nothing else.

## Done criteria

- [ ] `pnpm check` and `pnpm lint` exit 0
- [ ] `git diff` for `[id].astro` touches only the `<h3>`/`</h3>` → `<h2>`/`</h2>` pair at the fallback-variation block
- [ ] No other file changed (`git status`)

## STOP conditions

- The live file's heading structure at this location doesn't match the excerpt above (drift check).
- You find a CSS rule (in this repo, not a third-party stylesheet) that selects `h3` by bare tag name outside the shared `h1..h6` rule and the `.wp-content-block` blog rules already accounted for above — if so, the "markup-only" assumption is wrong and you should report the conflicting rule instead of proceeding.

## Maintenance notes

- This fallback branch is rare in practice (requires an empty/whitespace variation name from Square) — if it's ever observed live, that's itself worth investigating as a data-quality issue upstream, separate from this plan.
- Reviewer: this is a one-line-pair diff; confirm nothing else moved.
