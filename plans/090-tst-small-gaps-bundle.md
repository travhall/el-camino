# Plan 090: Fill small test gaps — batch inventory, quick-view product

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 915a062..HEAD -- src/lib/square/batchInventory.ts src/lib/product/quickViewController.ts`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: test-coverage
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

Two small test gaps surfaced in the deep audit:

**TST-07**: `src/lib/square/batchInventory.ts` — the file was split out from `inventory.ts` (see plan history) but its test file `src/lib/square/__tests__/batchInventory.test.ts` may not cover all exported paths (particularly error paths when Square API returns partial results).

**TST-08**: `src/lib/product/quickViewController.ts` — the quick-view controller has no test file; the happy path (open modal, close modal, gallery navigation) is untested.

Neither gap risks the global 80% threshold alone, but both represent untested product-critical code paths.

## Current state

Run:
```bash
ls src/lib/square/__tests__/batchInventory.test.ts
ls src/lib/product/__tests__/
```

to confirm which gaps exist.

## Commands

| Purpose | Command | Expected |
|---------|---------|---------|
| Tests | `pnpm test:run -- batch\|quickView` | all pass |
| Coverage | `pnpm test:coverage` | thresholds met |

## Scope

**In scope**:
- `src/lib/square/__tests__/batchInventory.test.ts` — add missing test cases if file exists; create if absent
- `src/lib/product/__tests__/quickViewController.test.ts` — new file

**Out of scope**: source files; no source changes

## Git workflow

- Branch: `advisor/090-tst-small-gaps-bundle`
- Commit: `test: fill small test gaps in batchInventory and quickViewController`

## Steps

### Step 1: Assess batchInventory coverage

Read `src/lib/square/batchInventory.ts` and `src/lib/square/__tests__/batchInventory.test.ts` (if it exists). Identify uncovered branches. Add tests for:
- Returns empty object when no variation IDs provided
- Handles partial Square API response (some IDs missing from result)
- Returns correct in-stock/out-of-stock mapping

### Step 2: Create quickViewController tests

Read `src/lib/product/quickViewController.ts`. Write tests for:
- `openQuickView` attaches product data to the modal
- `closeQuickView` removes the product and hides the modal
- `initGallery` does nothing when gallery has zero items (edge case)

Use DOM testing with `vi.fn()` stubs for `document.querySelector`; see existing browser-DOM test patterns in `src/lib/product/__tests__/` if any exist.

**Verify**: `pnpm test:run -- batch` and `pnpm test:run -- quickView` both pass

### Step 3: Coverage

```
pnpm test:coverage
```

## Done criteria

- [ ] `batchInventory.test.ts` covers at least the partial-response error path
- [ ] `quickViewController.test.ts` exists with ≥ 3 tests
- [ ] `pnpm test:coverage` exits 0
- [ ] No source files modified
- [ ] `plans/README.md` updated to DONE

## STOP conditions

- `quickViewController.ts` tests require real DOM/browser APIs that can't be mocked easily in vitest — investigate `vitest-environment: 'jsdom'` setting before writing; if too complex, descope to batchInventory only and note it

## Maintenance notes

Match mock patterns from `src/lib/square/__tests__/inventory.test.ts`.
