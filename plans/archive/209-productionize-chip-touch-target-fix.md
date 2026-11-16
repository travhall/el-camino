# Plan 209: Ship the chip touch-target + OOS-contrast fix (Plan 205's Option 1)

> **Executor instructions**: Follow step by step; run every verification command; on any STOP condition stop and report. Do NOT edit `plans/README.md`; report the outcome in your final message. This plan reapplies a diff that already exists and already passed gates on a spike branch — your job is to land it cleanly on current `master`, add the test coverage the spike skipped, and confirm nothing has drifted since.
>
> **Drift check (run first)**: `git diff --stat 45060e2..HEAD -- src/pages/product/\[id\].astro src/lib/product/pdpUI.ts src/components/SizeGuide.astro`. Also check whether `advisor/203-combination-aware-variant-availability` has been merged to `master` yet (`git log --oneline master | grep -i 203` or ask if unsure) — it touches the same chip-loop block in `[id].astro` (a different line range, the `isAvailable` computation just above where this plan edits the `class:list`). If it has landed, re-read that block on `master` before Step 2 and adapt line references; if anything else in the excerpts below doesn't match live `master`, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (the exact diff below already ran `pnpm check`/`lint`/`test:run` clean on the spike branch; this plan re-applies it to `master` and adds tests)
- **Depends on**: none hard. Soft: lands more cleanly if `advisor/203-combination-aware-variant-availability` (plan 203) merges first — same file, adjacent but non-overlapping lines.
- **Category**: bug (a11y) — WCAG 2.5.5 touch-target size and 1.4.3 text contrast
- **Planned at**: commit `f97637a`, 2026-09-27

## Why this matters

The maintainer reviewed two prototyped redesigns (plan 205) and picked this one: same filled-pill visual language, chips grown to a 44×44px minimum, and the selected-but-out-of-stock state's contrast fixed from a measured **1.54:1** (not the original audit's 3.87:1 — that number was wrong; see plan 205's README entry) up to **10.37:1**, plus a bonus fix to unselected-OOS chips (2.30:1 → 10.37:1) as a side effect of the same change. The other option (badge + dashed border, larger 48px pill) was not chosen — do not build it.

## Root cause (for context, not something to re-derive)

Baseline OOS chips intend to show faded meta-colored text (`text-(--content-meta)`) but Tailwind's generated stylesheet order lets `text-(--ui-variant-selected-text)` win instead when a chip is both selected and out of stock — unrelated to the order the classes appear in the markup. The fix makes `text-(--content-meta)` win explicitly with `!` (Tailwind's important-modifier syntax) and, for the selected+OOS case specifically, drops the filled selected-surface background for a `ring-2 ring-offset-1` ring instead, so the low-contrast fill never renders in the first place.

## Current state → target state (exact diff, already proven on the spike branch)

This is the literal diff from `advisor/205-spike-chip-redesign` commit `88ae594`, which already passed `pnpm check`/`pnpm lint`/`pnpm test:run` (1182/1182). Re-verify each excerpt against live `master` per the drift check above before applying (line numbers may have shifted slightly if unrelated plans landed first), then apply the same change.

### `src/pages/product/[id].astro`

**Multi-value attribute chips** (the common case, inside the `attributeTypes.map(...)` loop, ~line 752-774 on `master`):
```diff
                               class:list={[
-                                'px-2.5 py-1.5 rounded-sm attribute-button cursor-pointer relative',
-                                isSelected
-                                  ? 'border border-(--ui-variant-selected-border) bg-(--ui-variant-selected-surface) text-(--ui-variant-selected-text)'
-                                  : 'border border-(--ui-input-border) bg-(--ui-input-surface) text-(--ui-input-text)',
+                                'min-w-11 min-h-11 px-3 py-2 rounded-sm attribute-button cursor-pointer relative inline-flex items-center justify-center border',
+                                !isAvailable
+                                  ? 'border-(--ui-input-border) bg-(--ui-input-surface) text-(--content-meta)! line-through'
+                                  : isSelected
+                                    ? 'border-(--ui-variant-selected-border) bg-(--ui-variant-selected-surface) text-(--ui-variant-selected-text)'
+                                    : 'border-(--ui-input-border) bg-(--ui-input-surface) text-(--ui-input-text)',
                                 !isAvailable &&
-                                  'text-(--content-meta) line-through opacity-60',
+                                  isSelected &&
+                                  'ring-2 ring-offset-1 ring-(--ui-variant-selected-border)',
                               ]}
```

**Single-value display spans** — three separate occurrences, all identical in shape (`~line 733`, `~line 801`, `~line 828`):
```diff
-                            class="px-2.5 py-1.5 border rounded-sm bg-(--ui-variant-selected-surface) text-(--ui-variant-selected-text) border-(--ui-variant-selected-border) cursor-default"
+                            class="min-w-11 min-h-11 px-3 py-2 border rounded-sm bg-(--ui-variant-selected-surface) text-(--ui-variant-selected-text) border-(--ui-variant-selected-border) cursor-default inline-flex items-center justify-center"
```
(Apply to all three occurrences — they render a non-interactive, always-selected span for a single-value attribute, no state logic needed.)

**Unstructured-variation fallback buttons** (`~line 857-869` — same block plan 208 touched for its `h3`→`h2` fix; that change is a different line, no overlap):
```diff
                     class:list={[
-                      'px-4 py-2 border rounded-sm cursor-pointer',
-                      variation.variationId === defaultVariationId
-                        ? 'bg-(--ui-variant-selected-surface) text-(--ui-variant-selected-text) border-(--ui-variant-selected-border)'
-                        : 'bg-(--ui-input-surface) text-(--ui-input-text) border-(--ui-input-border)',
-                      !variation.inStock && 'opacity-60 line-through',
+                      'min-w-11 min-h-11 px-4 py-2 border rounded-sm cursor-pointer inline-flex items-center justify-center',
+                      !variation.inStock
+                        ? 'bg-(--ui-input-surface) text-(--content-meta)! border-(--ui-input-border) line-through'
+                        : variation.variationId === defaultVariationId
+                          ? 'bg-(--ui-variant-selected-surface) text-(--ui-variant-selected-text) border-(--ui-variant-selected-border)'
+                          : 'bg-(--ui-input-surface) text-(--ui-input-text) border-(--ui-input-border)',
+                      !variation.inStock &&
+                        variation.variationId === defaultVariationId &&
+                        'ring-2 ring-offset-1 ring-(--ui-variant-selected-border)',
                     ]}
```

**Trust-signal triggers** — three occurrences (`easy-returns-trigger`, `local-pickup-trigger`, `secure-checkout-trigger`, ~lines 1010-1060): add `py-3 -my-3` to each `class` string, e.g.
```diff
-              class="flex items-center gap-1.5 text-(--content-emphasis) hover:text-(--content-emphasis) hover:underline underline-offset-0 hover:underline-offset-4 transition-all cursor-pointer"
+              class="flex items-center gap-1.5 py-3 -my-3 text-(--content-emphasis) hover:text-(--content-emphasis) hover:underline underline-offset-0 hover:underline-offset-4 transition-all cursor-pointer"
```
This grows the clickable area to 44px tall via negative-margin-offset padding without changing the visible text row height — visually identical, verified on the spike.

### `src/components/SizeGuide.astro` (~line 16-19)

```diff
   type="button"
   id="size-guide-trigger"
-  class="text-sm font-semibold text-(--content-emphasis) hover:text-(--content-emphasis) hover:underline underline-offset-0 hover:underline-offset-4 transition-all cursor-pointer ml-auto"
+  class="text-sm font-semibold text-(--content-emphasis) hover:text-(--content-emphasis) hover:underline underline-offset-0 hover:underline-offset-4 transition-all cursor-pointer ml-auto inline-flex items-center py-3 -my-3"
   aria-label="Open size guide"
```

### `src/lib/product/pdpUI.ts` — `updateAttributeButtonStates` (~lines 360-428)

Replace the whole per-button `classList.add/remove` sequence (both the availability block and the selected-state block) with a single rebuilt class string, mirroring the SSR branch exactly so post-interaction state matches first paint:

```ts
const isAvailable = canAddToCartFn(attributeType, value);
const isSelected = selectedAttributes[attributeType] === value;

// Base sizing/shape + state classes rebuilt as one string, mirroring the
// SSR branch in src/pages/product/[id].astro exactly — OOS now wins the
// cascade outright (via `!important`) instead of losing to the
// selected-surface classes, and a ring stands in for the fill when both
// selected and OOS so the low-contrast filled-OOS state never renders.
const base =
  'min-w-11 min-h-11 px-3 py-2 rounded-sm attribute-button cursor-pointer relative inline-flex items-center justify-center border';
const stateClasses = !isAvailable
  ? 'border-(--ui-input-border) bg-(--ui-input-surface) text-(--content-meta)! line-through'
  : isSelected
    ? 'border-(--ui-variant-selected-border) bg-(--ui-variant-selected-surface) text-(--ui-variant-selected-text)'
    : 'border-(--ui-input-border) bg-(--ui-input-surface) text-(--ui-input-text)';
const ringClasses =
  !isAvailable && isSelected
    ? 'ring-2 ring-offset-1 ring-(--ui-variant-selected-border)'
    : '';

btn.className = [base, stateClasses, ringClasses].filter(Boolean).join(' ');

if (!isAvailable) {
  btn.setAttribute('aria-label', `${value} — out of stock`);
} else {
  btn.removeAttribute('aria-label');
}
btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
```

This fully replaces the existing `if (!isAvailable) { classList.add/remove... }` and `if (isSelected) { classList.add/remove... }` blocks — read the current function body first (it's in this plan's evidence, but re-confirm against live `master` per the drift check) and remove both in favor of the block above.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `pnpm check` | 0 errors |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test:run` | all pass |
| Coverage | `pnpm test:coverage` | exit 0 |

## Scope

**In scope**: `src/pages/product/[id].astro`, `src/lib/product/pdpUI.ts`, `src/components/SizeGuide.astro`, plus test additions in `src/lib/product/__tests__/pdpUI.test.ts`.

**Out of scope**: `variationParser.ts` (plans 203/207's file — don't touch), the trust-signal icons/text/behavior beyond the padding change, Option 2's design (badge + dashed border + 48px pill) — not chosen, do not build any part of it, `plans/204-*` and `plans/205-*` (rejected/superseded, leave as historical record).

## Git workflow

Branch `advisor/209-productionize-chip-touch-targets`; conventional commits (e.g. `fix: grow PDP variant chips to 44px and fix selected-OOS contrast`, `test: cover rebuilt attribute-button class states`). Do NOT push or open a PR.

## Steps

### Step 1: Re-confirm current state matches the excerpts
Read the live `master` copies of all three files at the line ranges cited above. If `advisor/203-combination-aware-variant-availability` has already merged, the `isAvailable` computation just above the chip loop in `[id].astro` will look different (it now calls `isAttributeValueAvailable(...)`) — that's fine and doesn't conflict with this plan's `class:list` change; just confirm the `class:list` block itself still matches before editing.
**Verify**: read-only, no command — confirm by eye, proceed only on a match.

### Step 2: Apply the `[id].astro` changes
Apply all five hunks (multi-value chips, three single-value spans, fallback variation buttons, three trust-signal triggers) exactly as shown above.
**Verify**: `pnpm check` → 0 errors.

### Step 3: Apply the `SizeGuide.astro` change
**Verify**: `pnpm check` → 0 errors.

### Step 4: Apply the `pdpUI.ts` change
Replace `updateAttributeButtonStates`'s per-button class manipulation as shown.
**Verify**: `pnpm check` → 0 errors; `pnpm test:run src/lib/product/__tests__/pdpUI.test.ts` — expect failures here if the existing tests assert the old `classList.add('text-(--content-meta)', 'line-through', 'opacity-60')` calls directly; that's expected, fix forward in Step 5, don't revert the source change.

### Step 5: Update/add tests in `pdpUI.test.ts`
Model on whatever existing `describe('updateAttributeButtonStates', ...)` block is already there. Assert, for each of the four states (unselected-available, selected-available, unselected-OOS, selected-OOS):
- The resulting `btn.className` matches the expected full string (or contains the expected key tokens — `min-w-11`, `min-h-11`, the right surface/text/border tokens, `text-(--content-meta)!`+`line-through` for OOS, `ring-2 ring-offset-1 ring-(--ui-variant-selected-border)` only for selected+OOS).
- `aria-pressed` is `"true"` only when selected.
- `aria-label` is set to `"<value> — out of stock"` only when unavailable, and removed when available.
- A transition between states (e.g. available→OOS on the same button) correctly drops the previous state's classes — since `className` is now a full replace rather than incremental `add`/`remove`, this should be trivially correct, but assert it anyway as a regression test for the old incremental-mutation bug class.

**Verify**: `pnpm test:run src/lib/product/__tests__/pdpUI.test.ts` → all pass.

### Step 6: Full gates
**Verify**: `pnpm check`, `pnpm lint`, `pnpm test:run`, `pnpm test:coverage` all exit 0; `git status` shows only the four in-scope files (3 source + 1 test) changed.

## Test plan

- Extend `pdpUI.test.ts` per Step 5 — happy-dom, model existing tests in the same file for DOM-construction pattern.
- No new e2e coverage needed — this is a visual/class-string change with existing unit coverage extended, not new behavior.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test:run`, `pnpm test:coverage` exit 0
- [ ] All four chip states (available/selected/OOS/selected-OOS) covered by tests in `pdpUI.test.ts`, all passing
- [ ] Live check (manual, by you or the maintainer): `huf-mason-pant`, select size 36 + Black — chip shows a ring, legible dark text, no low-contrast fill
- [ ] `git status` shows only `[id].astro`, `pdpUI.ts`, `SizeGuide.astro`, and `pdpUI.test.ts` changed

## STOP conditions

- Any excerpt above doesn't match live `master` beyond a trivial line-number shift (e.g. the class strings themselves differ) — re-read plan 205's README entry and this plan's diff before improvising a fix.
- `advisor/203-combination-aware-variant-availability` conflicts in a way that isn't a clean adjacent-line situation — report the actual conflict rather than resolving it by guessing which version is correct.

## Maintenance notes

- Option 2 (48px pill, checkmark badge, dashed OOS border) was prototyped on the same spike branch (`advisor/205-spike-chip-redesign`, commit `6801614`) and explicitly not chosen — don't resurrect it without the maintainer asking again.
- If plan 204-style mobile-CTA work is ever revisited (it was rejected this session — see `plans/README.md`), its "Option B" scoped-compression direction touches some of the same H1/spacing classes this plan doesn't touch; no conflict today, just noting the adjacency for whoever picks that back up.
