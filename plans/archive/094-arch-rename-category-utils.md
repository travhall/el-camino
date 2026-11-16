# Plan 094: Clarify naming in Square category files

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `ls src/lib/square/categor*`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: architecture
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`src/lib/square/` contains three category-related files whose names overlap:
- `categories.ts` — fetches and enriches category objects from Square
- `categoryUtils.ts` — pure utility functions (filtering, nav visibility)
- `categoryLookup.ts` — likely a lookup/index structure

The naming convention does not make the purpose of each file obvious. `categoryUtils.ts` could mean anything. A future developer reading the directory will not know which file to edit.

## Current state

Read all three files. Note what each exports. Then decide on rename targets based on their actual responsibility:
- `categories.ts` — probably fine as-is (it fetches categories)
- `categoryUtils.ts` — consider `categoryFilters.ts` or `categoryNav.ts` if its exports are nav-specific
- `categoryLookup.ts` — probably fine as-is if it's truly a lookup index

Read the imports across the codebase before renaming:
```bash
grep -rn "categoryUtils\|categoryLookup\|from.*categories" src/ --include="*.ts" --include="*.astro"
```

## Commands

| Purpose | Command | Expected |
|---------|---------|---------|
| Typecheck | `pnpm check` | no errors |
| Tests | `pnpm test:run` | all pass |

## Scope

**In scope**: rename `src/lib/square/categoryUtils.ts` if a clearer name is warranted; update all imports

**Out of scope**: changing exported function names or logic; no behavior change

## Git workflow

- Branch: `advisor/094-arch-rename-category-utils`
- Commit: `refactor: rename categoryUtils.ts to <chosen-name>.ts for clarity`

## Steps

### Step 1: Read all three files

Read `src/lib/square/categories.ts`, `src/lib/square/categoryUtils.ts`, `src/lib/square/categoryLookup.ts`. Identify the primary responsibility of each.

### Step 2: Decide on rename

If `categoryUtils.ts` exports are clearly nav-focused: rename to `categoryNav.ts`.
If exports are mixed general utilities: leave the name and update `plans/README.md` to note no rename needed.

### Step 3: Find all imports

```bash
grep -rn "categoryUtils" src/ --include="*.ts" --include="*.astro"
```

### Step 4: Rename and update imports

Rename the file. Update every import. Confirm no old filename remains:
```bash
grep -rn "categoryUtils" src/
```

### Step 5: Typecheck and tests

```
pnpm check
pnpm test:run
```

## Done criteria

- [ ] File renamed (or documented as not needed)
- [ ] All imports updated
- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `plans/README.md` updated to DONE

## STOP conditions

- `categoryUtils.ts` has a clearly mixed-purpose set of exports that doesn't map to a clean single name — leave the name and mark plan as SKIP with a note

## Maintenance notes

New category-related utilities go in the file whose name matches their responsibility.
