# Plan 093: Remove duplicate createSlug in Sidebar.astro

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 915a062..HEAD -- src/components/Sidebar.astro src/lib/square/slugUtils.ts`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: architecture
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`src/components/Sidebar.astro` line 66 defines a private `createSlug` function that duplicates the logic in `src/lib/square/slugUtils.ts`. Two slug implementations risk diverging — if someone updates the canonical version in `slugUtils.ts` for edge cases (diacritics, special chars), the Sidebar will silently use the old logic.

## Current state

Read `src/components/Sidebar.astro` around line 60-75 to see the private function.
Read `src/lib/square/slugUtils.ts` to see the canonical export.

Confirm they are logically equivalent before replacing.

## Commands

| Purpose | Command | Expected |
|---------|---------|---------|
| Typecheck | `pnpm check` | no errors |
| Tests | `pnpm test:run` | all pass |

## Scope

**In scope**: `src/components/Sidebar.astro` — remove private `createSlug`, import from `slugUtils`

**Out of scope**: `src/lib/square/slugUtils.ts` — do not modify the source of truth

## Git workflow

- Branch: `advisor/093-arch-sidebar-slug-dedup`
- Commit: `refactor: use canonical createSlug from slugUtils in Sidebar.astro`

## Steps

### Step 1: Verify equivalence

Read both implementations. If they differ (different regex, different case handling), STOP and report — don't silently change slug behavior.

### Step 2: Remove duplicate and import

In `src/components/Sidebar.astro`:
1. Delete the private `createSlug` function (around line 66)
2. Add import at the top of the script block: `import { createSlug } from '@/lib/square/slugUtils';` (or whatever the path alias resolves to)

### Step 3: Typecheck

```
pnpm check
```

### Step 4: Tests

```
pnpm test:run
```

## Done criteria

- [ ] Private `createSlug` function removed from `Sidebar.astro`
- [ ] `Sidebar.astro` imports `createSlug` from `slugUtils`
- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `plans/README.md` updated to DONE

## STOP conditions

- The two implementations differ — report the diff to the user; do not silently change slug output, as it affects URLs and could break existing links

## Maintenance notes

Any new Astro component that needs slug generation must import from `src/lib/square/slugUtils.ts`. Never re-implement locally.
