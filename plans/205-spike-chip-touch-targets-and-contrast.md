# Plan 205: Spike — PDP variant-chip touch-target redesign + selected-out-of-stock contrast

> **Executor instructions**: This is a **spike**, not a build plan. The deliverable is 2-3 concrete visual/interactive options for the chip component (as a live prototype and/or screenshots at multiple states) plus a written recommendation — not a shipped change to the live PDP. Do not merge or wire this into production code.
>
> **Drift check (run first)**: `git diff --stat 45060e2..HEAD -- src/pages/product/\[id\].astro src/lib/product/pdpUI.ts` — on a mismatch, re-read the excerpts below before proceeding.

## Status

- **Priority**: P2
- **Effort**: S (spike)
- **Risk**: LOW (no production code path is changed by this plan)
- **Depends on**: none (soft dependency on plan 204's outcome — if Option A there is chosen, the sheet's internal chips and its trigger row both need this redesign too)
- **Category**: direction
- **Planned at**: commit `45060e2`, 2026-09-27

## Why this matters

The PDP's variant chips (size, color, and the single-value/fallback variants) currently measure ~57-97px wide × 38px tall with ~8px gaps, and several adjacent controls (Size Guide link, trust-signal buttons) measure only 20px tall — all below the 44×44px CSS-pixel touch-target guidance (WCAG 2.5.5 / Apple HIG / Material). The maintainer wants to treat this as a redesign opportunity rather than a mechanical size bump, and wants to see options before any code lands. Bundled into the same redesign pass: the selected-but-out-of-stock chip state (e.g. a size that's currently selected but the resulting combination is OOS) measures 3.87:1 contrast against its background, below the 4.5:1 text minimum — the maintainer is open to leaving this as-is or fixing it as part of whatever new chip visual design comes out of this spike, but not as a standalone color-only patch.

## Current state

`src/pages/product/[id].astro`, the three chip-rendering branches (all in the "Info" column, `lines 705-836`):

- **Multi-value attribute chips** (`lines 752-774`, the common case — size/color pickers):
  ```astro
  <button
    type="button"
    data-attribute-type={attributeType}
    data-attribute-value={value}
    class:list={[
      'px-2.5 py-1.5 rounded-sm attribute-button cursor-pointer relative',
      isSelected
        ? 'border border-(--ui-variant-selected-border) bg-(--ui-variant-selected-surface) text-(--ui-variant-selected-text)'
        : 'border border-(--ui-input-border) bg-(--ui-input-surface) text-(--ui-input-text)',
      !isAvailable &&
        'text-(--content-meta) line-through opacity-60',
    ]}
    aria-pressed={isSelected ? 'true' : 'false'}
    aria-label={!isAvailable ? `${value} — out of stock` : undefined}
  >
    {value}
  </button>
  ```
  `px-2.5 py-1.5` (10px/6px padding) on a text-sized button — this is what measures ~38px tall live. `!isAvailable` is the selected-or-unselected-but-OOS state (line-through + `opacity-60`); this is the low-contrast case measured at 3.87:1 when combined with `isSelected`'s surface color.
- **Single-value display span** (non-interactive, `lines 800-806`) and the **variation-name fallback buttons** (`lines 845-866`, unstructured names) use the same `px-2.5 py-1.5` / `px-4 py-2` sizing pattern — any redesign should cover all three so the chip language stays one system, not three.
- The client-side equivalent that must stay in sync: `src/lib/product/pdpUI.ts:360-428` (`updateAttributeButtonStates`) rebuilds these same class lists on every variant change via `classList.add/remove` — whatever new classes the redesign picks must be mirrored there too, or the chip will revert to the old look after the first click.
- Nearby controls also under 44px, worth including in the same visual pass since they sit in the same interaction zone: `SizeGuide.astro:18` (`aria-label="Open size guide"` trigger, ~20px tall), trust-signal buttons `[id].astro:1003-1068` (Easy returns / Local pickup / Secure checkout, `text-sm` with `gap-1.5`, ~20px tall).
- Design tokens already in use for this component family (reuse, don't invent new ones unless the redesign specifically calls for it): `--ui-variant-selected-surface`, `--ui-variant-selected-text`, `--ui-variant-selected-border`, `--ui-input-surface`, `--ui-input-text`, `--ui-input-border`, `--content-meta`. Defined in the project's token layer — grep `src/styles/` for their `@theme`/`:root` declarations before proposing new ones.

## Options to prototype (produce at least 2; a 3rd if a materially different direction is worth showing)

For each option, show all four chip states: default/unselected, selected, unavailable/OOS (currently reachable via struck-through), and selected-but-OOS (the low-contrast case). Measure final touch-target dimensions and contrast ratios for every state — don't estimate, use the browser's computed styles the way this session's audit did (DevTools/computed color, WCAG contrast formula).

- **Option 1 — Minimal-footprint resize**: grow the existing pill shape to ≥44×44px (more padding, not necessarily more visual weight) and address the selected-OOS contrast within the same token family (e.g. a slightly different opacity or a dedicated OOS token) rather than introducing new shapes.
- **Option 2 — Visually distinct redesign**: a genuinely different chip treatment (e.g. larger swatches for color, a different selected-state indicator such as a checkmark or filled corner instead of border+fill, restructured OOS treatment that doesn't rely on opacity alone). This is where "let's mock them up" gets real design options, not just a bigger version of the current chip.
- **Option 3 (optional)**: anything else worth showing if the exploration turns up a direction clearly better than 1 and 2.

Include the Size Guide trigger and trust-signal buttons in whichever option is recommended, sized to match (they don't need their own separate design language, just to clear 44px and read as part of the same system).

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `pnpm check` | 0 errors |
| Lint | `pnpm lint` | exit 0 |

(No test-writing in this plan — it's a spike with no shipped logic.)

## Scope

**In scope**: a throwaway branch touching `src/pages/product/[id].astro` and `src/lib/product/pdpUI.ts` (both, so selected/OOS states render identically before and after a client-side re-render), for prototyping only.

**Out of scope**: `variationParser.ts` (plan 203's file), cart logic, desktop layout changes beyond what's needed to compare states side-by-side, any change to `src/styles/` token *values* (proposing a new token is fine; changing what an existing token resolves to, which would affect other components, is not).

## Git workflow

Branch `advisor/205-spike-chip-redesign`. Commit prefix `spike:`. Do NOT push, open a PR, or merge.

## Steps

### Step 1: Baseline measurement
On the live PDP at both 375px and 1024px+ widths, measure and record current dimensions and contrast for all four chip states listed above, plus the three under-44px adjacent controls. This confirms the audit's numbers and gives you a real before/after to report.

### Step 2: Build each option
Implement each option behind a way to toggle/compare them (separate routes, a query param, or just separate commits/screenshots — whatever is fastest to review). Mirror every markup change into `pdpUI.ts`'s `updateAttributeButtonStates` so post-interaction state matches SSR state — this is a common source of visual bugs on this page (see plan 203's "Why this matters" for a related SSR/client drift issue; don't repeat that pattern here).

### Step 3: Measure each option
Same measurements as Step 1, for every option, every state.

### Step 4: Report
Side-by-side screenshots (mobile + desktop, all four states) for each option, a table of dimensions and contrast ratios, and an explicit call-out of which option(s) fix the selected-OOS contrast and how. Do not pick a winner for the maintainer — present the options plainly.

## Done criteria

- [ ] `pnpm check` and `pnpm lint` pass on the prototype branch
- [ ] Every option shows all four chip states, measured (not estimated), at both mobile and desktop widths
- [ ] `pdpUI.ts`'s client-side class rebuild matches the SSR markup for whichever option(s) are shown as interactive prototypes
- [ ] Branch pushed nowhere; report says so explicitly
- [ ] `plans/README.md` status row for 205 updated — same convention as plan 204 (spike complete, awaiting maintainer choice)

## STOP conditions

- A proposed option would require changing what an existing design token resolves to (affects other components) — flag it instead of doing it silently.
- The excerpts above don't match the live file (see drift check).

## Maintenance notes

- If plan 204's Option A (bottom sheet) is chosen, revisit this spike's winning chip design inside the sheet layout too — chip sizing in a full-width sheet may differ from chip sizing in the current inline flex-wrap row.
- Whichever option ships becomes its own implementation plan with `pdpUI.ts` + `[id].astro` kept in lockstep, plus a regression test/checklist item confirming the two never drift (this repo has already had that exact class of bug — see plan 203).
