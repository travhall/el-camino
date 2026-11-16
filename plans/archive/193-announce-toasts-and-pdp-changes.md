# Plan 193: Screen readers hear toast notifications and PDP variant changes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 426d14e..HEAD -- src/components/Notification.astro src/lib/product/pdpUI.ts src/lib/product/pdpController.ts "src/pages/product/[id].astro"`
> On any change, compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (accessibility)
- **Planned at**: commit `426d14e`, 2026-09-26

## Why this matters

The repo has strong deliberate accessibility work (skip link, modal focus trap,
mobile-nav `aria-live` announcer, reduced-motion). Two gaps remain, both found
in a design/a11y audit and confirmed in source:

1. **Toasts are silent.** `src/components/Notification.astro` builds toasts
   (add-to-cart success, checkout errors, stock warnings) as plain `<div>`s
   appended to `#notification-container`, which has no `role` or `aria-live`
   (grep for `role|aria` in that file returns nothing). A screen-reader user
   adding to cart or hitting an error hears nothing.
2. **PDP variant changes are silent.** When a shopper picks a size/color,
   `pdpUI.ts` rewrites `#price-display`, `#remaining-count`, the
   add-to-cart button label, and `#cart-quantity` in place. None sit in a live
   region (the only `aria-live` on the PDP is inside `BackInStock.astro`).
   Price, stock, and "Out of stock"/"Add to Cart" changes are invisible to
   assistive tech.

Note: the audit PDF claimed the PDP *disables* dead-end variant combos. It
doesn't — `pdpUI.ts:~326` deliberately keeps out-of-stock buttons clickable
(to show the back-in-stock form) and labels them `aria-label="<value> — out of stock"`.
That is fine; this plan does not change it.

## Current state

- `src/components/Notification.astro:5-9` — container:

```astro
<div id="notification-container"
  class="fixed top-4 right-4 z-9999 flex flex-col gap-2 items-end pointer-events-none">
</div>
```

- `src/components/Notification.astro:~34-40` — each toast is created with `document.createElement('div')`, `className = 'pointer-events-auto flex …'`, a `<span>` with the message, optional action button/link; appended via `container.appendChild(notification)`; auto-removed after `duration` (default 3000 ms). Types: `'success' | 'error' | 'info' | 'warning'`.
- `src/lib/product/pdpUI.ts`: updates at ~line 151 (`addToCartButton.textContent = getButtonText(info.state)`), ~194-206 (`remainingCount.textContent = \`${info.remaining} available\``, `cartQuantity.textContent = \`( ${info.inCart} in cart )\``), ~230+ (price via `MoneyUtils.format`). Element lookup object at ~lines 54-93 (ids default e.g. `priceDisplay: customIds?.priceDisplay || 'price-display'`). Variant buttons already use `aria-pressed` — leave alone.
- `src/pages/product/[id].astro:~672-690` — `#price-display` `<p>`; `~913` — `#availability-indicator` `<div>` containing `#remaining-count` and `#cart-quantity`.
- Precedent to copy: the mobile-nav announcer in `src/components/Nav.astro` (~lines 535-550) — an `aria-live` region announcing menu state. Read it and match its pattern (visually-hidden class, politeness level, how text is set).
- Existing test file to extend: `src/lib/product/__tests__/pdpUI.test.ts` (read its setup first and match it).
- `QuickView.astro` / `quickViewController.ts` has a parallel variant-selection UI; **out of scope** (see Maintenance).

## Commands you will need

| Purpose   | Command              | Expected |
|-----------|----------------------|----------|
| Typecheck | `pnpm check`         | 0 errors |
| Lint      | `pnpm lint`          | exit 0   |
| Tests     | `pnpm test:run`      | all pass |
| Coverage  | `pnpm test:coverage` | exit 0   |

## Scope

**In scope**:
- `src/components/Notification.astro`
- `src/lib/product/pdpUI.ts`
- `src/pages/product/[id].astro` (only: add one visually-hidden live-region element near the price/availability block)
- `src/lib/product/__tests__/pdpUI.test.ts` (extend)

**Out of scope**:
- `QuickView.astro` / `quickViewController.ts`
- Visual styling of toasts or price
- Changing the `EVENTS.SHOW_NOTIFICATION` payload shape (`src/lib/events.ts`)
- Making `#price-display` etc. themselves `aria-live` (too chatty — use one dedicated region)

## Git workflow

- Branch: `advisor/193-announce-toasts-and-pdp`
- Conventional commits: `fix(a11y): announce toast notifications`, `fix(a11y): announce PDP variant changes`
- Do NOT push or open a PR.

## Steps

### Step 1: Make the toast container a live region
In `Notification.astro`, add to `#notification-container`: `role="region" aria-label="Notifications" aria-live="polite" aria-relevant="additions"`. (Live regions must exist in the DOM before content is inserted — the container is server-rendered, so this holds.) In `showNotification`, set `notification.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status')` on each toast so errors announce assertively and successes politely.

**Verify**: `pnpm check` → 0 errors; `grep -n "aria-live\|role" src/components/Notification.astro` → shows container attrs and per-toast role assignment.

### Step 2: Add a single PDP live status region
In `src/pages/product/[id].astro` add, adjacent to the price block (not inside `#price-display`): `<p id="pdp-live-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>` (Tailwind `sr-only` is already used in `src/pages/index.astro`).

**Verify**: `grep -c 'id="pdp-live-status"' "src/pages/product/[id].astro"` → `1`.

### Step 3: Announce on variant / stock change
In `pdpUI.ts`, add a method `announce(message: string)` that sets the region's `textContent`, debounced ~250 ms so rapid selection changes announce only the final state. Add `liveStatus: document.getElementById('pdp-live-status')` following the existing `elements` lookup pattern (~lines 54-93). Call it from the method(s) that update price + availability after a variant change (~lines 151-240), composing one message: `"<selected variant values>, <price>, <state>"` where state is `"in stock, N available"`, `"out of stock"`, etc., reusing whatever states `getButtonText(info.state)` already switches on — do not invent new states. Do **not** announce on initial page render — only on user-driven change (read `pdpController.ts` to find the selection handler and pass a flag or call `announce` from there). If the UI update path can't distinguish initial render from user change without refactoring the controller, STOP.

**Verify**: `pnpm check` → 0 errors.

### Step 4: Tests
Extend `src/lib/product/__tests__/pdpUI.test.ts` (happy-dom):
1. `announce()` writes text into `#pdp-live-status` after the debounce (`vi.useFakeTimers`).
2. Two rapid calls announce only the last message.
3. Missing region element → no throw.
For the toast change: try rendering `Notification.astro` via `AstroContainer` (`experimental_AstroContainer` from `astro/container`) and assert the container has `aria-live="polite"`; if the container API can't render it under the repo's vitest setup, skip and note in the commit body.

**Verify**: `pnpm test:run` → all pass; `pnpm test:coverage` → exit 0.

## Test plan

Unit tests per Step 4; manual VoiceOver pass (macOS: ⌘F5): add-to-cart toast; an error toast (add beyond stock in the cart); PDP size change to an in-stock size and to an out-of-stock size.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test:run`, `pnpm test:coverage` exit 0
- [ ] `grep -c 'aria-live' src/components/Notification.astro` ≥ 1
- [ ] `grep -n 'pdp-live-status' "src/pages/product/[id].astro" src/lib/product/pdpUI.ts` matches in both files
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- The PDP UI update function cannot separate initial render from user change without refactoring `pdpController.ts` (out of scope).
- `pdpUI.ts` has drifted so the element-lookup object at ~lines 54-93 no longer exists.
- Adding `role="alert"` to toasts breaks an existing e2e test selecting by role — report, don't rewrite the tests.

## Maintenance notes

- `QuickView` has its own copy of the variant state machine (see plans 179/183); when consolidated with the PDP, the announcer should move with it. Follow-up: add the same announcer to QuickView if plan 183 doesn't land first.
- Reviewer: over-announcement is the main risk — confirm the debounce and the "no announce on load" guard.
- Any new code calling `showNotification` now gets announcements for free.
