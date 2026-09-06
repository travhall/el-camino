# Plan 077: Fix unawaited updateQuantity in cart undo and pickup pre-open guard

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> ```
> git diff --stat 915a062..HEAD -- src/scripts/mini-cart-client.ts src/pages/api/create-checkout.ts
> ```
> If either in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (two independent bugs, one commit)
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

**BUG-04 — cart undo silently swallows updateQuantity result**

`src/scripts/mini-cart-client.ts:91` calls `cartInstance.updateQuantity(key, qty)`
without `await`. The very next line hardcodes `result = { success: true }`. If
`updateQuantity` fails (item gone, validation error), the undo UI reports success
and the notification says "Item restored" — but the cart wasn't updated. The
customer sees a ghost success message and the item is still missing.

**BUG-05 — pickup candidate can be before store opens**

`src/pages/api/create-checkout.ts:109` checks
`if (pickupHours && pickupHour < pickupHours.close)` to decide whether to
return the pickup candidate (`candidate + 2h`). The guard is missing
`&& pickupHour >= pickupHours.open`. If `candidate + 2h` lands after midnight
but before opening time on the next day, `pickupHour < close` passes (e.g.
`2 < 17`) even though the store isn't open yet. The customer is shown a pickup
time before the store opens.

## Current state

**BUG-04** — `src/scripts/mini-cart-client.ts`, lines 88–95:

```typescript
let result: { success: boolean; message?: string };
if (alreadyInCart) {
  // Item was re-added during the undo window — restore the snapshot quantity exactly
  cartInstance.updateQuantity(key, itemToRestore.quantity);  // line 91 — not awaited
  result = { success: true };                                 // line 92 — hardcoded
} else {
  result = await cartInstance.addItem(itemToRestore);
}
```

**BUG-05** — `src/pages/api/create-checkout.ts`, lines 107–112:

```typescript
const { jsDay: pickupDay, hour: pickupHour } = storeTimeOf(pickupCandidate);
const pickupHours = storeHoursForDay(pickupDay, hoursData);
if (pickupHours && pickupHour < pickupHours.close) {   // line 109 — missing >= open guard
  return pickupCandidate;
}
// Pickup window would exceed close — keep searching for the next slot.
```

The correct intent: only return a pickup candidate if it falls within store
operating hours on that day, i.e. `>= open AND < close`.

## Commands you will need

| Purpose   | Command                           | Expected on success |
|-----------|-----------------------------------|---------------------|
| Typecheck | `pnpm check`                      | exit 0, no errors   |
| Tests     | `pnpm test:run -- create-checkout`| all pass            |
| Coverage  | `pnpm test:coverage`              | all thresholds met  |

## Scope

**In scope**:
- `src/scripts/mini-cart-client.ts` (BUG-04)
- `src/pages/api/create-checkout.ts` (BUG-05)
- `src/pages/api/__tests__/create-checkout.test.ts` (new test for BUG-05)

**Out of scope**:
- `src/lib/cart/index.ts` — `updateQuantity` implementation is correct; only the caller is broken
- Any component that calls `nextPickupTime` — fix the function, not callers

## Git workflow

- Branch: `advisor/077-fix-cart-undo-and-pickup-preopen`
- Commit: `fix: await updateQuantity in cart undo and add pickup open-hours guard`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Await updateQuantity and use its real result (BUG-04)

In `src/scripts/mini-cart-client.ts`, find the undo handler (lines 88–95)
and change the `updateQuantity` call to:

```typescript
let result: { success: boolean; message?: string };
if (alreadyInCart) {
  result = await cartInstance.updateQuantity(key, itemToRestore.quantity);
} else {
  result = await cartInstance.addItem(itemToRestore);
}
```

Confirm that `CartManager.updateQuantity` returns
`Promise<{ success: boolean; message?: string }>` (or compatible shape)
by reading `src/lib/cart/index.ts` before making this change. If the return
type is `void` or `undefined`, add a `CartOperationResult`-shaped return value
to `updateQuantity` first (follow the same pattern as `addItem`), then update
this call.

**Verify**: `pnpm check` → exit 0

### Step 2: Add the missing open-hours guard (BUG-05)

In `src/pages/api/create-checkout.ts`, find the pickup candidate check
(around line 109) and change:

```typescript
if (pickupHours && pickupHour < pickupHours.close) {
```

to:

```typescript
if (pickupHours && pickupHour >= pickupHours.open && pickupHour < pickupHours.close) {
```

One-line change. Do not touch any surrounding logic.

**Verify**: `pnpm check` → exit 0

### Step 3: Add a test for the open-hours guard

In `src/pages/api/__tests__/create-checkout.test.ts`, add a test that
verifies a pickup candidate that falls before store opening on the next day
is skipped:

```typescript
it('skips a pickup candidate that falls before store open on the next day', () => {
  // Simulate: candidate + 2h crosses midnight, landing at 2am on a day
  // that opens at 10am — should keep searching, not return 2am
  const hoursData = buildMockHoursData({ open: 10, close: 18 });
  const afterMidnightCandidate = new Date('2026-01-02T02:00:00');
  // The store should NOT return a pickup at 2am
  const result = nextPickupTime(afterMidnightCandidate, hoursData);
  const { hour } = storeTimeOf(result);
  expect(hour).toBeGreaterThanOrEqual(10); // within open hours
});
```

Model test helpers (`buildMockHoursData`, `storeTimeOf`) after existing tests
in that file. If `nextPickupTime` isn't exported from `create-checkout.ts`,
check whether there's a separate `shopHours.ts` or `pickupTime.ts` module —
adjust the import accordingly.

**Verify**: `pnpm test:run -- create-checkout` → all pass including new test

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `updateQuantity` in the undo handler is awaited and its result used
- [ ] The `result = { success: true }` hardcode is removed
- [ ] `pickupHours && pickupHour >= pickupHours.open && pickupHour < pickupHours.close` in BUG-05
- [ ] New test for the open-hours guard passes
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `updateQuantity` returns `void` — update its return type first, following the `addItem` pattern, and treat that as a prerequisite step
- `nextPickupTime` is not directly testable (closure, not exported) — add an export or test at the HTTP-handler level; do not skip the test
- Lines 88–95 or 107–112 differ significantly from the excerpts above

## Maintenance notes

- BUG-04: If `updateQuantity` is later changed to be synchronous, remove the `await` and the pattern collapses cleanly.
- BUG-05: The open-hours guard mirrors what the primary `initialCandidate` check already does at the top of the function (lines 91–93) — this fix makes the inner loop consistent with the outer guard.
