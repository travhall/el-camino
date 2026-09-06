# Plan 068: Fix after-hours nextPickupTime scheduling past store close

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/pages/api/create-checkout.ts`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/067-pickup-time-fractional-hours.md (should run first)
- **Category**: correctness
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

`nextPickupTime()` in `create-checkout.ts:79-105` handles the case where a
customer orders after store hours. The after-hours path finds the next 15-minute
slot that falls within business hours, then adds 2 hours to that slot as the
pickup window:

```ts
if (hours && hour >= hours.open && hour < hours.close) {
  return roundUpTo15(new Date(candidate.getTime() + 2 * 60 * 60 * 1000));  // +2h
}
```

If the store has a short operating window — e.g. opens at 10 AM and closes at
11 AM — and the code finds a candidate at 10:30 AM (within hours), it returns
10:30 AM + 2h = 12:30 PM, which is 1.5 hours **past close**. The Square Checkout
API will reject a pickup time outside store hours.

**Depends on plan 067**: after plan 067, `storeTimeOf` returns fractional hours,
which makes the `hours.open`/`hours.close` comparison reliable for non-hourly
boundaries. This plan should run after 067, but can be applied independently if
the fractional-hour issue is kept in mind.

## Current state

`src/pages/api/create-checkout.ts:92-105` (after-hours path):

```ts
let candidate = initialCandidate;
for (let i = 0; i < 7 * 24 * 4; i++) {
  const { jsDay, hour } = storeTimeOf(candidate);
  const hours = storeHoursForDay(jsDay, hoursData);
  if (hours && hour >= hours.open && hour < hours.close) {
    return roundUpTo15(new Date(candidate.getTime() + 2 * 60 * 60 * 1000));
    //                                                        ↑ may exceed close
  }
  candidate = new Date(candidate.getTime() + 15 * 60 * 1000);
}
```

## Commands you will need

| Purpose        | Command              | Expected on success      |
|----------------|----------------------|--------------------------|
| Typecheck      | `pnpm check`         | exit 0, no errors        |
| Unit tests     | `pnpm test:run`      | all pass                 |

## Scope

**In scope**:
- `src/pages/api/create-checkout.ts` — the after-hours loop in `nextPickupTime` only

**Out of scope**:
- The fast-path check at line 88 (same file, different branch) — no change needed there
- `storeHoursForDay` and `storeTimeOf` — only fix their usage here

## Git workflow

- Branch: `advisor/068-after-hours-pickup-past-close`
- Commit message: `fix: validate after-hours pickup window does not exceed store close time`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read the full `nextPickupTime` function

Read `src/pages/api/create-checkout.ts` lines 79–105. Understand:
1. What `candidate` represents (initial candidate = now + 2h, rounded to 15 min).
2. What the loop returns when it finds a slot within hours.
3. How `roundUpTo15` works.

### Step 2: Add a close-time guard before returning

Inside the loop body, before returning `candidate + 2h`, check that
`candidate + 2h` is still before the store's close time that day. If it
exceeds close, continue iterating (let the loop find the next open slot):

```ts
if (hours && hour >= hours.open && hour < hours.close) {
  const pickupCandidate = roundUpTo15(new Date(candidate.getTime() + 2 * 60 * 60 * 1000));
  const { hour: pickupHour } = storeTimeOf(pickupCandidate);
  const pickupHours = storeHoursForDay(storeTimeOf(pickupCandidate).jsDay, hoursData);
  if (pickupHours && pickupHour < pickupHours.close) {
    return pickupCandidate;
  }
  // pickup window would exceed close — keep searching
}
```

This ensures the returned pickup time is itself within business hours, not just
that the starting point was.

### Step 3: Typecheck and test

```bash
pnpm check
```

Expected: exit 0.

```bash
pnpm test:run
```

Expected: all pass.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] The after-hours loop no longer returns a pickup time > `hours.close`
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- After adding the guard, the loop always falls through to the fallback for your
  test scenario — add a debug log inside the loop temporarily to trace which
  candidates are found and why none satisfy the guard; report results rather
  than guessing.
