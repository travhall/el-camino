# Plan 072: Enable The Shop page (admin toggle)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/pages/admin/settings/ src/lib/shopVisibility.ts`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P2 (product decision required before executing)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

**"The Shop" page is fully built and hidden behind an admin visibility toggle.**
It is not a missing feature — it is a finished feature waiting for activation.

Evidence:
- `src/pages/admin/settings/navigation.astro` contains a UI toggle (lines 74–75)
  labeled "The Shop" with an enabled/disabled state.
- `src/lib/shopVisibility.ts` reads the toggle value and gates the public
  `/shop` route.
- The shop product pages, cart, and checkout flows are all fully operational.

The only reason The Shop is hidden is a deliberate choice captured in the admin
settings. **This plan is a product decision, not a technical task.** The executor
must confirm with the business owner before toggling the setting live.

## How to enable

### Option A: Admin UI (preferred)
1. Log in to the admin panel.
2. Navigate to Settings → Navigation.
3. Toggle "The Shop" to enabled.
4. Save.

No code changes required.

### Option B: Code default (if admin toggle is not accessible)

Read `src/lib/shopVisibility.ts` to find the default value when no admin
setting is stored. If it defaults to `false` (hidden), change the default to
`true` and document the change. This should only be done if the admin UI is
broken or inaccessible.

```bash
cat src/lib/shopVisibility.ts
```

If changing the default in code:

```ts
// Likely pattern — confirm exact code first:
const isShopVisible = stored ?? false;  // before
const isShopVisible = stored ?? true;   // after (fallback to visible)
```

## Commands you will need

| Purpose          | Command                | Expected on success        |
|------------------|------------------------|----------------------------|
| Typecheck        | `pnpm check`           | exit 0                     |

## Scope

**In scope** (Option B only):
- `src/lib/shopVisibility.ts` — default value only

**Out of scope**:
- Shop page structure, components, or routing — already complete
- Checkout flows — already complete

## Git workflow (Option B only)

- Branch: `advisor/072-enable-shop-page`
- Commit message: `feat: default shop page to visible`
- Do NOT push or open a PR unless instructed.

## STOP conditions

- The executor has not received explicit confirmation from the business owner
  that The Shop should be publicly visible — STOP; do not toggle it.
- `shopVisibility.ts` has complex logic beyond a simple boolean toggle — read
  it fully and report before changing anything.
