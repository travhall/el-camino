# Plan 075: Separate email-send failure from blob-cleanup failure in webhook handler

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 915a062..HEAD -- src/pages/api/webhooks/square.ts`
> If the in-scope file changed since this plan was written, compare excerpts below
> against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`deletePendingOrder(orderId)` lives inside the same `try` block as `sendOrderConfirmation`.
If Netlify Blobs has a transient failure and the delete throws, the `catch` block calls
`storeFailedEmail(orderId, order, contact, emailErr)` — with the blob-delete error as
`emailErr`, not an email failure. The admin retry queue now shows this order and when retried
via `src/pages/api/admin/retry-failed-emails.ts`, sends a duplicate confirmation email to the
customer. Fix: move `deletePendingOrder` into its own `try/catch` so that blob cleanup failure
is logged and swallowed without creating a fake retry record.

## Current state

**File**: `src/pages/api/webhooks/square.ts`, lines 200–222:

```typescript
try {
  await sendOrderConfirmation({ order, contact });          // line 201

  if (contact.fulfillmentMethod === "pickup") {
    await sendPickupNotification({ order, contact });
  } else if (contact.fulfillmentMethod === "shipping") {
    await sendShippingOrderNotification({ order, contact });
  }

  await deletePendingOrder(orderId);                        // line 212 — inside same try
  console.log(`[Webhook/Square] All emails sent for order: ${orderId}`);
} catch (emailErr) {                                        // line 215 — catches BOTH
  console.error(`[Webhook/Square] Email delivery failed for order ${orderId}:`, emailErr);
  await storeFailedEmail(orderId, order, contact, emailErr).catch((blobErr) => {
    console.error(`[Webhook/Square] Failed to store retry record:`, blobErr);
  });
  // Pending order blob intentionally NOT deleted — idempotency guard stays intact
}
```

Imports already in the file:
```typescript
import { getPendingOrder, deletePendingOrder } from "@/lib/email/pendingOrders";
import { storeFailedEmail } from "@/lib/email/failedEmails";
```

Note: This block is inside a `switch` statement (`case "payment.completed":` or similar).
Read the live surrounding structure before deciding how to break out after the email catch.

## Commands you will need

| Purpose   | Command                      | Expected on success |
|-----------|------------------------------|---------------------|
| Typecheck | `pnpm check`                 | exit 0, no errors   |
| Tests     | `pnpm test:run -- webhook`   | all pass            |
| Coverage  | `pnpm test:coverage`         | all thresholds met  |

## Scope

**In scope**:
- `src/pages/api/webhooks/square.ts`
- `src/pages/api/__tests__/webhook-square.test.ts`

**Out of scope**:
- `src/lib/email/pendingOrders.ts`
- `src/lib/email/failedEmails.ts`
- `src/pages/api/admin/retry-failed-emails.ts`

## Git workflow

- Branch: `advisor/075-fix-webhook-false-email-retry`
- Commit: `fix: separate email-send failure from blob-cleanup failure in webhook handler`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read the live file structure around lines 200–222

Before editing, read `src/pages/api/webhooks/square.ts` lines 185–230 to understand the
surrounding `switch/case` structure. Confirm that lines 200–222 match the excerpt above.
If they don't, treat this as a STOP condition.

### Step 2: Split into two try blocks

Replace the single try/catch block with two nested try blocks:

```typescript
// Try 1: email sends only
try {
  await sendOrderConfirmation({ order, contact });
  console.log(`[Webhook/Square] Confirmation email sent to ${contact.email}`);

  if (contact.fulfillmentMethod === "pickup") {
    await sendPickupNotification({ order, contact });
  } else if (contact.fulfillmentMethod === "shipping") {
    await sendShippingOrderNotification({ order, contact });
  }
  console.log(`[Webhook/Square] All emails sent for order: ${orderId}`);
} catch (emailErr) {
  console.error(`[Webhook/Square] Email delivery failed for order ${orderId}:`, emailErr);
  // Only store retry record when the email send itself failed
  await storeFailedEmail(orderId, order, contact, emailErr).catch((blobErr) => {
    console.error(`[Webhook/Square] Failed to store retry record:`, blobErr);
  });
  // Pending order blob intentionally NOT deleted — idempotency guard stays intact
  break;  // exit the switch case (adjust if not in a switch)
}

// Try 2: blob cleanup — independent of email success
// Only reached when emails sent successfully (we didn't break above)
try {
  await deletePendingOrder(orderId);
} catch (cleanupErr) {
  // Blob cleanup failure is non-fatal — emails already sent, log and continue
  console.warn(`[Webhook/Square] Failed to delete pending order ${orderId}:`, cleanupErr);
}
```

**Verify**: `pnpm check` → exit 0

### Step 3: Add a test for the separated error paths

In `src/pages/api/__tests__/webhook-square.test.ts`, add:

```typescript
it('does not create a retry record when deletePendingOrder fails but emails succeeded', async () => {
  // emails succeed
  vi.mocked(sendOrderConfirmation).mockResolvedValueOnce(undefined);
  vi.mocked(sendPickupNotification).mockResolvedValueOnce(undefined);
  // blob cleanup fails
  vi.mocked(deletePendingOrder).mockRejectedValueOnce(new Error('Blob unavailable'));
  const storeFailedEmailMock = vi.mocked(storeFailedEmail);

  const response = await POST(buildSquareWebhookRequest(/* valid payment.completed event */));

  expect(storeFailedEmailMock).not.toHaveBeenCalled();
  expect(response.status).toBe(200);
});
```

Model mock setup after the existing webhook test structure in that file.

**Verify**: `pnpm test:run -- webhook` → all pass including new test

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run -- webhook` exits 0 with new test passing
- [ ] `storeFailedEmail` is called only from inside the email-send `catch` block
- [ ] `deletePendingOrder` is in its own `try/catch` that logs-and-continues on failure
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- Lines 200–222 do not match the excerpt above
- The block structure makes splitting the try impossible without touching out-of-scope files
- `storeFailedEmail` or `deletePendingOrder` have already been refactored

## Maintenance notes

- The idempotency invariant is preserved: pending blob is only deleted after all emails
  succeed — same semantics as before, just in a separate error domain.
- If Square ever retries the webhook and the pending blob was not deleted (due to cleanup
  failure), the second webhook delivery will still find `getPendingOrder()` data and proceed
  normally — idempotency is intact.
