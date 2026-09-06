# Plan 102: Cross-link sale items from The Shop page

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 915a062..HEAD -- src/pages/the-shop/index.astro`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: product decision (see below)
- **Category**: direction
- **Planned at**: commit `915a062`, 2026-08-01

## Product decision required

**Before implementing**, confirm with the user:
1. Does a `/sale` or `/specials` page exist, or should it be a filtered view of the shop?
2. Should the cross-link appear as a banner on The Shop page, a nav item, or a product grid section?
3. What Square catalog field marks an item as "on sale" — a custom attribute, a discount, or a specific category?

Do not implement until these are answered.

## Why this matters

The audit (DIR-01) found that sale items exist in the Square catalog but are not surfaced from The Shop page. Customers browsing the shop have no path to see discounted items unless they happen to find them in a category. Cross-linking from The Shop increases sale item visibility and conversion.

## Current state

Read `src/pages/the-shop/index.astro` to understand how products are listed. Then check if a sale page or sale category exists:
```bash
grep -rn "sale\|discount\|specials" src/ --include="*.ts" --include="*.astro" -i | head -20
```

## Commands

| Purpose | Command | Expected |
|---------|---------|---------|
| Typecheck | `pnpm check` | no errors |
| Build | `pnpm build` | exits 0 |

## Scope

**In scope**: surface sale items from The Shop page (banner, section, or link — per product decision)

**Out of scope**: creating a new `/sale` page (that's a separate plan if needed); changing Square catalog structure

## Git workflow

- Branch: `advisor/102-dir-sale-crosslink`
- Commit: `feat: cross-link sale items from The Shop page`

## Steps

Steps depend on the product decision above. Once confirmed:

### If a sale category exists in Square:
1. Read `src/lib/square/categories.ts` — find how categories are fetched
2. Filter for the sale category and surface its products as a section or banner on `the-shop/index.astro`
3. Add a "See all sale items" link pointing to the category filtered view

### If sale is determined by a price discount:
1. Read how pricing is fetched in the shop page context
2. Filter products where `priceMoney < regularPriceMoney` (or equivalent Square field)
3. Render a "On Sale" chip or section

**Verify**: `pnpm check` then `pnpm build` exits 0.

## Done criteria

- [ ] Product decision confirmed before implementation
- [ ] Sale items visible or linked from The Shop page
- [ ] `pnpm check` exits 0
- [ ] `pnpm build` exits 0
- [ ] `plans/README.md` updated to DONE

## STOP conditions

- No sale/discount data exists in the Square catalog — confirm with user before building UI

## Maintenance notes

If sale items are managed via Square discounts rather than a category, the display logic must handle the case where no items are on sale (empty state, hide the section entirely).
