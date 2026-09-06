# Plan 088: Add unit tests for categories.ts and categoryUtils.ts

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 915a062..HEAD -- src/lib/square/categories.ts src/lib/square/categoryUtils.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: test-coverage
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`src/lib/square/categories.ts` (category data fetch and enrichment) and `src/lib/square/categoryUtils.ts` (category filtering, nav visibility logic) have no test files. Both are critical to the navigation and product filtering experience. A regression in category enrichment silently breaks the nav.

## Current state

Run `ls src/lib/square/__tests__/` — confirm `categories.test.ts` and `categoryUtils.test.ts` are absent.

Read both source files before writing tests to understand their exports, arguments, and return shapes.

## Commands

| Purpose   | Command                              | Expected |
|-----------|--------------------------------------|---------|
| Tests     | `pnpm test:run -- categor`           | all pass |
| Coverage  | `pnpm test:coverage`                 | thresholds met |

## Scope

**In scope**: `src/lib/square/__tests__/categories.test.ts` (new), `src/lib/square/__tests__/categoryUtils.test.ts` (new)

**Out of scope**: source files — tests only

## Git workflow

- Branch: `advisor/088-tst-categories-utils-tests`
- Commit: `test: add unit tests for categories.ts and categoryUtils.ts`

## Steps

### Step 1: Read source files

Read `src/lib/square/categories.ts` and `src/lib/square/categoryUtils.ts` fully. Note all exported functions and their argument/return types.

### Step 2: Create categories.test.ts

Mock `squareClient` and `productCache`. Test at minimum:
- Returns empty array when catalog has no CATEGORY type objects
- Maps a category object to the expected `Category` shape (id, name, imageUrl, slug)
- Handles missing image IDs gracefully

### Step 3: Create categoryUtils.test.ts

Test at minimum:
- `getNavigationCategories` (or equivalent) returns only categories with products
- A category with zero matching products is excluded from nav
- Slug generation is consistent with `slugUtils.createSlug`

**Verify**: `pnpm test:run -- categor` → all pass

### Step 4: Coverage

```
pnpm test:coverage
```

## Done criteria

- [ ] Both test files exist and pass
- [ ] `pnpm test:coverage` exits 0
- [ ] No source files modified
- [ ] `plans/README.md` status updated to DONE

## STOP conditions

- Either source file was significantly refactored after commit `915a062` — read live files first

## Maintenance notes

Match mock patterns from `src/lib/square/__tests__/inventory.test.ts`.
