# Plan 047: Consolidate duplicate createSlug implementations

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/lib/square/categories.ts src/lib/square/slugUtils.ts`
> If any changes appear, compare the "Current state" excerpts before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

Two different `createSlug` implementations exist:

- `src/lib/square/slugUtils.ts:7` — exported, strips `[^a-z0-9\s-]`, limits to
  50 chars. Used for **product** slugs.
- `src/lib/square/categories.ts:17` — private, strips `[^\w\s-]` (keeps
  underscores), no length cap. Used for **category** slugs.

They produce different output for any category name containing underscores or
longer than 50 characters: `"kids_clothing"` → `"kids-clothing"` (slugUtils) vs
`"kids_clothing"` (categories). Category URLs built with the private version can
mismatch `getCategoryBySlug` if it ever uses the slugUtils version, breaking
routing silently. Maintaining two implementations guarantees drift.

**Risk is MED** because the regex change (removing underscore support from
category slugs) will affect URLs for any live category whose name contains
underscores. Verify live Square category names before proceeding.

## Current state

**`src/lib/square/slugUtils.ts`** — the canonical implementation:
```typescript
// line 7
export function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 50);
}
```

**`src/lib/square/categories.ts`** — private duplicate at line 17:
```typescript
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")  // \w keeps underscores — differs from slugUtils
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  // no .slice(0, 50)
}
```

Used at `categories.ts:67`:
```typescript
slug: createSlug(item.categoryData?.name || ""),
```

## Commands you will need

| Purpose   | Command              | Expected on success       |
|-----------|----------------------|---------------------------|
| Typecheck | `pnpm check`         | exit 0, no errors         |
| Unit tests | `pnpm test:run`     | all pass                  |

## Scope

**In scope**:
- `src/lib/square/categories.ts`
- `src/lib/square/slugUtils.ts` — only if the canonical regex needs adjustment

**Out of scope**:
- `src/lib/square/slugUtils.ts` regex — prefer leaving it unchanged; note any
  needed adjustment as a STOP condition

## Git workflow

- Branch: `advisor/047-consolidate-create-slug`
- Commit message: `refactor: remove duplicate createSlug in categories.ts, use slugUtils`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Check live category names for underscores

```bash
# Grep for any category name that contains an underscore in the Square catalog
# (can't check Square directly — look for test fixtures or known category names)
grep -rn "categoryData\|categoryName\|category_name" src/ | grep "_" | head -20
```

Also check any test fixtures:
```bash
grep -rn "createSlug\|categoryData" src/lib/square/__tests__/ 2>/dev/null | head -20
```

If any live category name contains underscores AND the site has indexed URLs
for those categories (they'd appear in sitemaps, internal links), the slug change
will break those URLs — treat this as a STOP condition and report.

If no live category names use underscores, proceed.

### Step 2: Replace private createSlug in categories.ts with slugUtils import

Open `src/lib/square/categories.ts`:

1. Delete the private `createSlug` function (lines ~17–27).
2. Add an import at the top of the file:
   ```typescript
   import { createSlug } from "./slugUtils";
   ```
3. The call at line 67 (`slug: createSlug(item.categoryData?.name || "")`)
   requires no change — same function name.

**Verify**: `grep -n "function createSlug" src/lib/square/categories.ts` → no match.
**Verify**: `grep -n 'from.*slugUtils' src/lib/square/categories.ts` → match.

### Step 3: Typecheck and test

```bash
pnpm check
```
Expected: exit 0, no errors.

```bash
pnpm test:run
```
Expected: all pass. If any test asserts category slugs with underscores, update
the expected value to match the canonical (underscore-stripped) output.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep -n "function createSlug" src/lib/square/categories.ts` → no match
- [ ] `grep -n 'from.*slugUtils' src/lib/square/categories.ts` → match
- [ ] No files outside `categories.ts` are modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- Live category names contain underscores AND those categories have indexed URLs
  (found in `src/pages/sitemap.xml.ts`, internal `<a>` links, or known from the
  Square dashboard) — this change would break those URLs. Stop and report.
- `pnpm check` errors after the import change — check that `createSlug` in
  `slugUtils.ts` is exported as a named export (it is, at line 7 per the plan).
- A test asserts specific category slug values with underscores and the expected
  value cannot be updated safely — stop and report.

## Maintenance notes

- The `slugUtils.ts` canonical implementation slices to 50 chars. If any
  category name is >50 characters and has URLs in the wild, those URLs will also
  break. Check the longest category name in the Square catalog before deploying.
- If the 50-char limit is a problem for categories, extend `createSlug` in
  `slugUtils.ts` to accept an optional `maxLength` parameter with a default of 50.
