# Plan 051: Eliminate duplicate catalog pagination loop in categories.ts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/lib/square/categories.ts src/lib/square/client.ts`
> If any changes appear, compare the "Current state" excerpts before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 050 (soft — plan 050 changes client.ts imports; land 050 first if possible)
- **Category**: tech-debt
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

`categories.ts:fetchAllCatalogItems` (lines ~143–186) is a private function that
paginates `squareClient.catalog.list({ types: "ITEM" })` with a 20-request safety
cap and BigInt serialization via `JSON.parse/stringify`. `client.ts:fetchProducts`
(lines ~191–367) does the exact same pagination against the same endpoint with the
same safety cap, but returns typed `Product[]` objects. They will drift independently.

The private `fetchAllCatalogItems` was added because `categories.ts` needed raw
catalog objects to access `item.itemData.*` directly, before `fetchProducts`
returned a rich `Product` type. Today `fetchProducts` returns enough data to
support the filtering that `fetchProductsByCategory` does. This plan removes
`fetchAllCatalogItems` and rewires `fetchProductsByCategory` to use `fetchProducts`.

**Risk is MED**: `fetchAllCatalogItems` returns raw `any[]` — the downstream
mapping in `categories.ts` accesses `item.itemData.*` directly from the Square
SDK shape. `fetchProducts` returns `Product[]` using the project's own type.
Verify the field mappings are equivalent before proceeding.

## Current state

**`src/lib/square/categories.ts`** — private fetcher (~lines 143–186):
```typescript
async function fetchAllCatalogItems(): Promise<any[]> {
  const allItems: any[] = [];
  let cursor: string | undefined;
  let requestCount = 0;
  do {
    const response = await squareClient.catalog.list({ types: "ITEM", cursor });
    // BigInt serialization via JSON.parse(JSON.stringify(response, jsonStringifyReplacer))
    const page = /* BigInt-sanitized items */ [];
    allItems.push(...page);
    cursor = /* next cursor */;
    requestCount++;
  } while (cursor && requestCount < 20);
  return allItems;
}
```

Used in `fetchProductsByCategory` which filters `allItems` by checking
`item.itemData.categories`, `item.itemData.name`, etc.

**`src/lib/square/client.ts:fetchProducts`** — exported, returns `Product[]`.
Read `src/lib/square/types.ts` (or wherever `Product` is defined) to confirm
which fields are available.

## Commands you will need

| Purpose   | Command              | Expected on success       |
|-----------|----------------------|---------------------------|
| Typecheck | `pnpm check`         | exit 0, no errors         |
| Unit tests | `pnpm test:run`     | all pass                  |

## Scope

**In scope**:
- `src/lib/square/categories.ts`

**Out of scope**:
- `src/lib/square/client.ts` — do not change `fetchProducts`
- Callers of `fetchProductsByCategory` — signature must remain the same

## Git workflow

- Branch: `advisor/051-eliminate-duplicate-catalog-pagination`
- Commit message: `refactor: remove duplicate fetchAllCatalogItems, use fetchProducts in categories.ts`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Audit the field access in fetchProductsByCategory

Read `src/lib/square/categories.ts` in full. List every field accessed on the
`item` objects returned by `fetchAllCatalogItems` (e.g. `item.itemData.name`,
`item.itemData.categories`, `item.id`, etc.).

Then read `src/lib/square/client.ts:fetchProducts` to confirm what fields are
present on the returned `Product` type (read the `Product` type definition).

If any field accessed in `categories.ts` is NOT present on `Product`, this is a
STOP condition — report the missing fields.

### Step 2: Replace fetchAllCatalogItems usage with fetchProducts

In `src/lib/square/categories.ts`:

1. Import `fetchProducts` from `./client` (or from `@/lib/square/client`).
2. In `fetchProductsByCategory`, replace the call to `fetchAllCatalogItems()`
   with `await fetchProducts()`.
3. Update the downstream item access from `item.itemData.*` to `product.*`
   using the `Product` field names identified in Step 1.
4. Delete the entire `fetchAllCatalogItems` private function.

**Verify**: `grep -n "fetchAllCatalogItems" src/lib/square/categories.ts` → no match.
**Verify**: `grep -n "fetchProducts" src/lib/square/categories.ts` → match.

### Step 3: Typecheck and test

```bash
pnpm check
```
Expected: exit 0. Any type errors indicate a field mismatch — fix them.

```bash
pnpm test:run
```
Expected: all pass. If any test mocks `fetchAllCatalogItems`, update the mock
to `fetchProducts` instead.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep -n "fetchAllCatalogItems" src/lib/square/categories.ts` → no match
- [ ] `grep -n "fetchProducts" src/lib/square/categories.ts` → match
- [ ] No files outside `categories.ts` are modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `Product` type is missing a field that `fetchAllCatalogItems` callers access
  (e.g. `item.itemData.categories` does not map to any `Product` field) — stop
  and report the specific missing fields. Do not add `as any` workarounds.
- `fetchProducts` is significantly slower than `fetchAllCatalogItems` for the
  category filtering use case (it may apply different filters) — benchmark before
  proceeding if concerned.

## Maintenance notes

- Removing the `"all-catalog-items-v3"` cache key (used in `fetchAllCatalogItems`)
  will abandon any warm blob under that key — harmless (it will expire naturally).
- After this change, all product data in the codebase flows through a single
  paginator. Future pagination changes (cap increase, different error handling)
  only need to be made in one place.
