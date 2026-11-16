# Plan 173: Allow a mistyped tracking number to be corrected

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If anything in "STOP conditions" occurs, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/pages/api/admin/mark-shipped.ts src/lib/email/sender.ts`
> On any change, compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

Once an order is marked shipped, a wrong or missing tracking number cannot be
fixed.

Two mechanisms combine. The fulfillment lookup filters out fulfillments already
in `COMPLETED` state, so a second submission throws
`"No active SHIPMENT fulfillment found"` and redirects to `?error=fetch`. And
even if it did find one, the Square idempotency key is
`` `shipped-${orderId}-${targetState}` `` — constant per order and state — so
Square would dedupe the update and silently discard the corrected value.

Meanwhile `sendShippingConfirmation` has already gone out with whatever was
typed. The customer's email and the Square order can permanently disagree, and
the shop owner has no way to reconcile them from the admin UI.

For a small shop where one person does fulfillment by hand, a typo here is a
matter of when, not if.

## Current state

`src/pages/api/admin/mark-shipped.ts:55-61` — the lookup excludes completed
fulfillments:

```ts
      (f: Fulfillment) =>
        f.type === 'SHIPMENT' &&
        f.state !== 'COMPLETED' &&
        f.state !== 'CANCELED'
    );
    if (!fulfillment?.uid)
      throw new Error('No active SHIPMENT fulfillment found');
```

`src/pages/api/admin/mark-shipped.ts:103-118` — tracking only attaches on the
final transition, under a stable key:

```ts
      // Only attach tracking/carrier on the final COMPLETED transition.
      const shipmentDetails =
        targetState === 'COMPLETED' && (trackingNumber || carrier)
          ? {
              ...(trackingNumber ? { trackingNumber } : {}),
              ...(carrier ? { carrier } : {}),
            }
          : undefined;

      await squareClient.orders.update({
        orderId,
        // Stable idempotency key per state — safe to retry if a step fails.
        idempotencyKey: `shipped-${orderId}-${targetState}`,
```

The stable key is **correct for its stated purpose** — retrying a failed state
transition. The bug is that it also blocks a genuinely different operation:
amending tracking on an already-completed shipment. Do not remove the stable key;
add a distinct path.

## Commands you will need

| Purpose   | Command                                | Expected             |
|-----------|----------------------------------------|----------------------|
| Typecheck | `pnpm check`                           | exit 0               |
| Tests     | `pnpm test:run -- mark-shipped`        | all pass             |
| Full      | `pnpm test:run`                        | exit 0               |
| Coverage  | `pnpm test:coverage`                   | exit 0, no regression|
| Lint      | `pnpm lint`                            | exit 0               |
| Dev server| `pnpm dev`                             | serves on :4321      |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/pages/api/admin/mark-shipped.ts`
- its test file under `src/pages/api/__tests__/`
- the admin order view that posts to it — **only** to add an "update tracking"
  affordance, if Step 4 shows one is needed

**Out of scope** (do NOT touch):
- The existing state-walk idempotency key for the normal path. It is correct.
- `sendShippingConfirmation` and the email templates. Whether a correction
  re-notifies the customer is a product decision — see Step 3.
- `src/lib/admin/auth.ts` and the route's auth/CSRF checks.
- Any other admin route.

## Git workflow

- Branch: `advisor/173-allow-tracking-number-correction`
- Conventional commits, e.g. `fix(admin): allow tracking details to be corrected after shipping`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Confirm Square's dedup behavior

The claim that Square discards a second update under the same idempotency key is
inferred from documented semantics, **not observed**. Verify it against the
sandbox before designing around it: mark a sandbox order shipped with tracking
`AAA`, then submit again with `BBB` under the same key and read back the order.

**Verify**: record what Square actually did in the `plans/README.md` status row.
If the second update *is* applied, the fix is only the lookup filter — much
smaller. Adjust the remaining steps accordingly and say so.

### Step 2: Add an amend path for completed shipments

Introduce an explicit "update tracking" operation, distinct from the state walk:

- The fulfillment lookup for this operation accepts `COMPLETED` shipments
  (but still excludes `CANCELED`).
- Its idempotency key derives from the **tracking payload** — e.g. a hash of
  `orderId` + `trackingNumber` + `carrier` — so each distinct correction is a
  distinct operation, while an accidental double-submit of the same correction
  still dedupes.
- The normal state-walk path keeps its existing stable key, untouched.

**Verify**: `grep -n "idempotencyKey" src/pages/api/admin/mark-shipped.ts` →
two distinct key derivations, each commented with its purpose.

### Step 3: Decide the customer-notification behavior, and ask

A corrected tracking number probably *should* reach the customer — but re-sending
the shipping confirmation could equally read as a duplicate shipment.

**This is the operator's call.** Default to **not** re-sending, and surface the
question in the status row. If they want a re-send, that is a follow-up.

**Verify**: default behavior implemented; question recorded.

### Step 4: Provide a way to trigger it

Check whether the admin order view can already post an update to an order that
shows as shipped.

```bash
grep -rn "mark-shipped" src/pages/admin/
```

If not, add a minimal "update tracking" affordance on already-shipped orders.
Keep it small — this plan is about making correction *possible*, not redesigning
the admin UI.

**Verify**: from `pnpm dev`, an already-shipped order can be given a new tracking
number through the UI.

### Step 5: Verify end to end against sandbox

1. Mark a sandbox order shipped with tracking `AAA`.
2. Correct it to `BBB`.
3. Read the order back from Square.

**Verify**: Square reflects `BBB`. Record before/after. This is the plan's
primary evidence.

### Step 6: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm test:coverage
```
→ all exit 0.

## Test plan

Extend the `mark-shipped` test file (model on the existing admin route tests,
which mock `squareClient.orders`):

- normal state walk still uses the stable `shipped-${orderId}-${targetState}` key
  (regression)
- the amend path finds a `COMPLETED` SHIPMENT fulfillment rather than throwing
- two different tracking numbers produce two **different** idempotency keys
- the same tracking number submitted twice produces the **same** key
- a `CANCELED` fulfillment is still excluded from both paths
- the amend path does not send a shipping confirmation email (per Step 3's default)

`pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

- [ ] Step 1's observed Square dedup behavior recorded in `plans/README.md`
- [ ] Two distinct idempotency key derivations exist, each commented
- [ ] The amend path accepts `COMPLETED` shipments; `CANCELED` still excluded
- [ ] The normal state walk is behaviorally unchanged (regression test)
- [ ] Step 5's sandbox before/after recorded
- [ ] Notification behavior defaults to no re-send; question surfaced to operator
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` all exit 0

## STOP conditions

Stop and report if:

- **You cannot test against a Square sandbox.** Idempotency behavior is the whole
  premise; shipping this unverified risks breaking the working
  mark-as-shipped path, which is worse than the bug.
- Step 1 shows Square *does* accept the second update — the fix shrinks to the
  lookup filter. Report and simplify rather than building the amend path anyway.
- The state machine turns out to allow transitions this plan did not anticipate
  (e.g. re-opening a COMPLETED fulfillment).
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The principle**: a stable idempotency key must cover one logical operation.
  `shipped-${orderId}-${targetState}` conflated "walk to this state" with
  "set tracking", so the two collided. New Square mutations should derive keys
  from what makes the operation distinct.
- Correcting tracking in Square does **not** correct the email already sent. That
  gap remains by design after this plan — worth telling the shop owner so they
  know to follow up manually.
- A reviewer should confirm the normal path's key is byte-identical to before.
