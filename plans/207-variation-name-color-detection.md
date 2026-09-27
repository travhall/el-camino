# Plan 207: Detect color for single-token variation names (fixes generic "Option" label where a real name applies)

> **Executor instructions**: Follow step by step; run every verification command; on any STOP condition stop and report. Do NOT edit `plans/README.md`; report the outcome in your final message.
>
> **Drift check (run first)**: `git diff --stat 45060e2..HEAD -- src/lib/square/variationParser.ts` — on a mismatch, re-read the excerpts below before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (additive change to one branch of a pure function; existing 2-part and other-length-part logic is untouched)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `45060e2`, 2026-09-27

## Why this matters

`parseVariationName` already has a heuristic, `detectAttributeType`, that recognizes common color words ("black", "denim", "olive", etc.) — but it is only invoked for 2-part, comma-separated variation names (`"Large, Black"`). A variation whose Square-side name is a single token with no comma (`"Black"`, `"White"`) skips detection entirely and falls straight to the positional fallback, which maps a 1-part name to the generic attribute key `variant`, displayed as `"Option"` (`VARIATION_CONFIG.displayNames.variant`). This is why products like Lil Jawns Standard Rails (colors: Black/White/Orange/Yellow/Purple, each a single-token variation name) show the picker labeled "Option" instead of "Color," even though the values are plainly colors and the detection logic to recognize them already exists — it's just never called for this shape of input. This is a small, additive fix: run the existing detector on single-token names too, keep the `variant`/"Option" fallback for anything it doesn't recognize (e.g. gift-card amounts like `"$25"`, which correctly stay generic).

## Current state

`src/lib/square/variationParser.ts`:
- `VARIATION_CONFIG` (`lines 12-29`): `attributeMappings: { 1: ['variant'], 2: ['size', 'color'], ... }`, `displayNames: { ..., variant: 'Option' }`.
- `detectAttributeType(value)` (`lines 35-101`): pure function, takes one string, returns `'size' | 'color' | 'material' | null` based on regex/word-list matching. Already module-private, used only inside `parseVariationName`.
- `parseVariationName(name)` (`lines 110-171`): splits on comma, trims, filters empty parts. For `parts.length === 2` (`lines 126-154`), calls `detectAttributeType` on both parts and uses whichever types it finds (falling back to a size/color guess if only one is detected). For **any other part count**, including exactly 1 (`lines 156-168`), it skips detection and does pure positional mapping via `VARIATION_CONFIG.attributeMappings[parts.length]` — for `parts.length === 1` that's always `['variant']`.
- `getAttributeDisplayName(attributeType)` (`lines 327-331`) resolves `'variant'` → `'Option'` via `VARIATION_CONFIG.displayNames`. Not modified by this plan.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `pnpm check` | 0 errors |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test:run` | all pass |

## Scope

**In scope**: `src/lib/square/variationParser.ts` (the `parts.length === 1` branch inside `parseVariationName` only, `lines 156-168`), `src/lib/square/__tests__/variationParser.test.ts`.

**Out of scope**: the 2-part detection logic (`lines 126-154`), `VARIATION_CONFIG` itself (no new attribute types, no changes to `attributeMappings` or `displayNames`), `detectAttributeType`'s word lists (don't add a money/amount pattern in this plan — see Maintenance notes), any other file that imports from `variationParser.ts` (`[id].astro`, `pdpController.ts`, etc. — they call `parseVariationName`/`getAttributeDisplayName` and need no changes; the fix is transparent to them).

## Git workflow

Branch `advisor/207-variation-name-color-detection`; conventional commits (e.g. `fix: detect color for single-token variation names`, `test: cover 1-part variationParser color detection`). Do NOT push or open a PR.

## Steps

### Step 1: Extend the 1-part branch

In `parseVariationName`, before the existing fallback block at `lines 156-168`, add a check that mirrors the 2-part branch's use of `detectAttributeType` but for a single part:

```ts
// Single-token names ("Black", "$25") skip comma-based detection above.
// Still try the same heuristic detector before falling back to the
// generic 'variant' key, so recognizable values (e.g. plain colors) get
// their real attribute type and display name instead of "Option".
if (parts.length === 1) {
  const detectedType = detectAttributeType(parts[0]);
  if (detectedType) {
    return { [detectedType]: parts[0] };
  }
}
```

Place this so it runs before the existing `VARIATION_CONFIG.attributeMappings[parts.length] || ...` fallback (which still handles `parts.length === 1` when `detectedType` is `null` — e.g. `"$25"` matches none of `detectAttributeType`'s size/color/material patterns, so it falls through exactly as today, staying `variant`/"Option"). Do not change the fallback block itself — only add this earlier return.

**Verify**: `pnpm check` → 0 errors.

### Step 2: Unit tests

In `src/lib/square/__tests__/variationParser.test.ts`, extend the `describe('parseVariationName', ...)` block (model new cases on the existing 2-part color-detection tests in the same describe block):
- `parseVariationName('Black')` → `{ color: 'Black' }` (was `{ variant: 'Black' }` before this fix).
- `parseVariationName('Orange')`, `parseVariationName('Denim')` → same pattern, `{ color: ... }`.
- `parseVariationName('Cotton')` → `{ material: 'Cotton' }` (exercises the material word list on a single token, not just color).
- `parseVariationName('28')` → still `{ size: '28' }`? **Check this carefully**: `detectAttributeType`'s size regex includes `/^\d+$/`, so a bare numeric single-token name like `'28'` would now map to `size` instead of `variant`. Confirm this is correct/desirable (a numeric single-value axis is far more likely to be a size than a generic "Option") — if any existing test or `getAttributeValues`/`buildAvailableAttributes` caller relies on bare numeric names staying `variant`, that test will fail and tell you; if it does, treat this specific sub-case as a STOP condition (see below) rather than special-casing around it silently.
- `parseVariationName('$25')` → still `{ variant: '$25' }` (unchanged fallback — the "$25" gift-card case; confirms nothing was broken).
- `parseVariationName('')` → still `{}` (unchanged, guarded earlier in the function).

**Verify**: `pnpm test:run src/lib/square/__tests__/variationParser.test.ts` → all pass, including the new cases.

### Step 3: Full test suite

Run the whole suite, not just this file — `buildAvailableAttributes`, `getAttributeValues`, and anything in `pdpController.test.ts` / `pdpController-real.test.ts` that constructs variations from single-token names could be affected by the `variant` → `color`/`material`/`size` reclassification.

**Verify**: `pnpm test:run` → all pass. If anything fails, read the failure before changing test expectations — a failure here means some other code assumed single-token names always land in `variant`, which is exactly the kind of coupling this plan should surface, not paper over.

### Step 4: Gates

**Verify**: `pnpm check`, `pnpm lint`, `pnpm test:run` all exit 0; `git status` shows only `variationParser.ts` and its test file changed.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test:run` exit 0
- [ ] New tests for single-token color/material/size/fallback cases pass
- [ ] `$25`-style (or other non-matching) single-token names still map to `variant` (unchanged behavior, confirmed by test)
- [ ] `git status` shows only `variationParser.ts` and its test file changed

## STOP conditions

- Any existing test outside `variationParser.test.ts` fails after this change and the failure indicates other code depends on single-token names always being classified as `variant` — stop and report which test/file, rather than adding a special case to force the old behavior back.
- The excerpts above don't match the live code (drift check).

## Maintenance notes

- Gift-card denomination names (`"$25"`, `"$50"`, ...) intentionally still fall back to `variant`/"Option" after this fix — `detectAttributeType` has no money/amount pattern. If the maintainer wants those labeled "Amount" instead of "Option," that is a separate, follow-up change (add an amount regex to `detectAttributeType` and a `'variant-money'`-style type + display name, or a small dedicated check) — do not add it speculatively in this plan.
- Reviewer: the interesting review question is the `'28'` → `size` reclassification called out in Step 2 — confirm it was checked against the real test suite, not assumed safe.
