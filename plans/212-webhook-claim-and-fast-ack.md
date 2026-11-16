# Plan 212: Make the Square webhook send each order email once and answer inside Square's timeout

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.

> **Drift check (run first)**:
> `git diff --stat 2ba4b13..HEAD -- src/pages/api/webhooks/square.ts src/lib/email/pendingOrders.ts`
> If any listed file changed, compare the "Current state" notes against the
> live code first; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: —
- **Category**: bug
- **Planned at**: commit `2ba4b13`, 2026-11-16

## Why this matters

Square abandons a webhook delivery after about 3 seconds and retries it. A
cold-start delivery to this handler was measured at 5.4 seconds on 2026-11-03.
The handler does all its work before answering, and the only guard against
sending the customer's confirmation twice is deleting the pending-order record
*after* the emails go out. A retry that arrives while the first delivery is
still running finds the record still there.

**This is a lead read from the code, not an observed duplicate.** Step 1
exists to prove or kill it.

## Current state

`src/pages/api/webhooks/square.ts`, `payment.updated` branch:

- `:209` `const contact = await getPendingOrder(orderId);` reads the record.
- `:229` fetches the order from Square.
- `:253-263` sends the confirmation, then the pickup or shipping notification.
- `:289` `await deletePendingOrder(orderId);` runs only after all emails sent.
- `:312` the 200 response is returned after all of the above.

`src/lib/email/pendingOrders.ts` exports `storePendingOrder`,
`getPendingOrder`, `deletePendingOrder`. There is no claim or in-progress
marker. `payment.updated` can also be delivered more than once with status
COMPLETED for the same payment.

## Steps

### Step 1: Reproduce with a failing test

In `src/pages/api/__tests__/webhook-square.test.ts`, add a test that invokes
`POST` twice concurrently with the same signed `payment.updated` COMPLETED
event, with `sendOrderConfirmation` mocked to resolve after a delay.

**Verify**: the test fails today, showing `sendOrderConfirmation` called
twice. If it passes, the lead is wrong: record that in the README row, skip
Steps 2 and 3, and continue from Step 4.

### Step 2: Claim before sending

Add `claimPendingOrder(orderId)` to `pendingOrders.ts`: an atomic
take-or-fail, using a conditional blob write on a `claim/<orderId>` key so
only one delivery wins; the loser returns without sending. Look up the exact
conditional-write option in the installed `@netlify/blobs` version before
writing it.

On email failure, release the claim so the admin retry path
(`storeFailedEmail`) and a later Square retry still work. Keep the existing
"pending record survives a failed send" behavior.

**Verify**: Step 1's test passes; the existing failed-email tests still pass.

### Step 3: Also guard on Square's event id

Record the event id of each handled payment event (short-lived blob key) and
skip an id already seen. This covers a retry that arrives after the first
delivery finished and cleaned up.

**Verify**: new test: the same event delivered twice in sequence sends one
email.

### Step 4: Answer first, work after

Return 200 as soon as the signature is verified and the event parsed, and run
the slow work (Square order fetch, emails, cache clears, purge) after the
response using the Netlify function context's `waitUntil`. Confirm how the
Astro Netlify adapter exposes that context before relying on it.

**Verify**: a unit test asserts the response resolves before the mocked email
send does. On a deploy preview, a cold delivery returns in under 1 second in
the function log.

### Step 5: Full gate

`pnpm check && pnpm lint && pnpm test:coverage` all exit 0.

## STOP conditions

- `waitUntil` is not available through the adapter in this version: do not
  fake it with an un-awaited promise (the function may be frozen mid-send).
  Ship Steps 1 to 3 and report.
- The conditional blob write is not supported by the installed version: stop
  and report rather than building a read-then-write check, which has the same
  race.
