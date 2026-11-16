# Plan 050: Decompose client.ts and break circular import with productUtils.ts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/lib/square/client.ts src/lib/square/productUtils.ts`
> If any changes appear, compare the "Current state" excerpts before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

`src/lib/square/client.ts` and `src/lib/square/productUtils.ts` have a circular
import: `client.ts:12` imports `extractBrandValue`, `extractIsGiftCard`,
`fetchMeasurementUnits` from `productUtils.ts`; `productUtils.ts:3` imports
`squareClient` from `client.ts`. Node ESM hoists around this today, but if
initialization order shifts (bundler change, test isolation change, module
refactor) `squareClient` can be `undefined` when `productUtils` initializes.

Additionally, `client.ts` is a 556-line god module mixing singleton init,
serialization utils, domain helpers, and data-fetching — every file that
imports `squareClient` pulls in all of it.

The fix: create `src/lib/square/catalogUtils.ts` to house the custom-attribute
helpers (`extractSaleInfo`, `extractBrandValue`, `extractIsGiftCard`) and
`jsonStringifyReplacer`. `client.ts` imports from there (not from `productUtils`),
breaking the cycle. `productUtils.ts` stops importing from `client.ts` for
the attribute helpers (it gets them from `catalogUtils.ts`).

## Current state

**`src/lib/square/client.ts:12`**:
```typescript
import { extractBrandValue, extractIsGiftCard, fetchMeasurementUnits } from "./productUtils";
```

**`src/lib/square/productUtils.ts:3`**:
```typescript
import { squareClient } from "./client";
```

**`src/lib/square/client.ts`** also exports (find exact lines with grep):
- `extractSaleInfo` — used by `categories.ts`, `pricing.ts`, `src/pages/api/sale-info.ts`
- `jsonStringifyReplacer` — used by files that serialize Square BigInt values

**`src/lib/square/productUtils.ts`** exports:
- `extractBrandValue`, `extractIsGiftCard` — used by `client.ts`
- `fetchMeasurementUnits` — called in `client.ts` for measurement unit resolution

## Commands you will need

| Purpose   | Command              | Expected on success       |
|-----------|----------------------|---------------------------|
| Find callers | `grep -rn "extractSaleInfo\|jsonStringifyReplacer\|extractBrandValue\|extractIsGiftCard" src/` | lists all import sites |
| Typecheck | `pnpm check`         | exit 0, no errors         |
| Unit tests | `pnpm test:run`     | all pass                  |
| Coverage  | `pnpm test:coverage` | thresholds pass           |

## Scope

**In scope**:
- `src/lib/square/catalogUtils.ts` — create new file
- `src/lib/square/client.ts` — remove moved exports, update imports
- `src/lib/square/productUtils.ts` — update imports
- All files importing `extractSaleInfo` or `jsonStringifyReplacer` from `client.ts`
  (found via grep in Step 1)

**Out of scope**:
- `src/lib/square/categories.ts`, `pricing.ts`, `src/pages/api/sale-info.ts` —
  update their import paths only; do not change logic
- Any test file logic — update mock paths only if needed

## Git workflow

- Branch: `advisor/050-client-decompose-circular-import`
- Commit message: `refactor: extract catalogUtils.ts, break client.ts circular import with productUtils.ts`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Map all callers of symbols being moved

```bash
grep -rn "extractSaleInfo\|jsonStringifyReplacer\|extractBrandValue\|extractIsGiftCard" src/
```

Record: which file exports each symbol currently and which files import it.
This is your complete migration map.

### Step 2: Create src/lib/square/catalogUtils.ts

Create a new file `src/lib/square/catalogUtils.ts`. Move these symbols into it:
- `extractSaleInfo` (currently in `client.ts`)
- `jsonStringifyReplacer` (currently in `client.ts`)
- `extractBrandValue` (currently in `productUtils.ts`)
- `extractIsGiftCard` (currently in `productUtils.ts`)

Copy the full implementation of each. Export all four. If any of these functions
reference `squareClient` or other `client.ts` symbols internally, resolve those
imports in `catalogUtils.ts` directly (import `squareClient` from `./client`
if needed — that direction does NOT create a cycle).

**Verify**: `grep -n "export" src/lib/square/catalogUtils.ts` → all four symbols exported.

### Step 3: Update client.ts

In `src/lib/square/client.ts`:

1. Remove the import of `extractBrandValue`, `extractIsGiftCard`,
   `fetchMeasurementUnits` from `./productUtils`.
2. Add import of `extractBrandValue`, `extractIsGiftCard` from `./catalogUtils`.
3. Remove the declarations/exports of `extractSaleInfo` and `jsonStringifyReplacer`
   (they now live in `catalogUtils.ts`).
4. Add re-exports for backward compatibility if any other file imports them from
   `client.ts` (found in Step 1) — or update those callers directly (preferred).

**Verify**: `grep -n "from.*productUtils" src/lib/square/client.ts` → no match.
**Verify**: `grep -n "from.*catalogUtils" src/lib/square/client.ts` → match.

### Step 4: Update productUtils.ts

`productUtils.ts` imported `squareClient` from `./client`. Confirm this import
still works (it should — `catalogUtils.ts` imports from `client.ts`, not the
reverse). No changes needed in `productUtils.ts` unless it also imported
`extractSaleInfo` or `jsonStringifyReplacer` — update those to `./catalogUtils`.

**Verify**: `grep -n "from.*client" src/lib/square/productUtils.ts` → import of `squareClient` only (or none if `fetchMeasurementUnits` was the only coupling).

### Step 5: Update all other callers

For every file in Step 1 that imports `extractSaleInfo` or `jsonStringifyReplacer`
from `./client` or `@/lib/square/client`:
- Update the import to use `@/lib/square/catalogUtils` (or relative equivalent).

**Verify**: `grep -rn "from.*client.*extractSaleInfo\|from.*client.*jsonStringifyReplacer" src/` → no matches.

### Step 6: Typecheck and test

```bash
pnpm check
```
Expected: exit 0, no errors.

```bash
pnpm test:coverage
```
Expected: thresholds pass.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:coverage` exits 0
- [ ] `src/lib/square/catalogUtils.ts` exists with `extractSaleInfo`, `jsonStringifyReplacer`, `extractBrandValue`, `extractIsGiftCard` exported
- [ ] `grep -n "from.*productUtils" src/lib/square/client.ts` → no match
- [ ] `grep -rn "from.*client.*extractSaleInfo" src/` → no match
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `extractSaleInfo` or `jsonStringifyReplacer` implementations in `client.ts`
  depend on non-exported private functions in `client.ts` that can't move —
  investigate whether those privates can also move to `catalogUtils.ts`.
- `pnpm check` reports a cycle after the change — run
  `npx madge --circular src/lib/square/` (if available) to visualize remaining
  cycles and report.
- A test file mocks `@/lib/square/client` for `extractSaleInfo` — update the
  mock path to `@/lib/square/catalogUtils`.

## Maintenance notes

- `client.ts` should eventually be further reduced to: singleton init + `fetchProducts`
  + `fetchProduct` only. That's a follow-up refactor; this plan only breaks the
  cycle — don't scope-creep into moving `fetchProducts`.
- New custom-attribute helpers belong in `catalogUtils.ts`, not `client.ts`.
