# Plan 136: Persist failed shipping-confirmation emails for admin retry

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cdf74a3..HEAD -- src/pages/api/admin/mark-shipped.ts src/lib/email/failedEmails.ts src/pages/api/admin/retry-failed-emails.ts src/pages/api/webhooks/square.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW-MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `cdf74a3`, 2026-09-04

## Why this matters

`mark-shipped.ts` walks a Square order's fulfillment state machine all the
way to `COMPLETED` (an irreversible, already-committed Square-side mutation)
*before* attempting to send the customer's shipping-confirmation email. If
that send fails (a transient Resend outage, a bad recipient address, etc.),
the handler just redirects with `?error=email` — the order is already marked
shipped in Square, but the customer never gets their confirmation or
tracking number, and there is no in-app way to retry. Worse, re-clicking
"mark shipped" for the same order doesn't retry the email: the order lookup
explicitly excludes fulfillments already in `COMPLETED` state, so it throws
`'No active SHIPMENT fulfillment found'`, which the same handler's earlier
catch block maps to the *generic* `?error=fetch` — indistinguishable from an
unrelated fetch failure, actively misleading whoever is troubleshooting it.

This repo already solved the identical problem for order-confirmation
emails on the webhook path (`plans/038-webhook-email-retry-queue.md`,
`plans/075-...md`): persist the failed send to a `failedEmails` Blob store,
surface it via `GET /api/admin/retry-failed-emails`, and let an admin retry
it via `POST`. This plan extends that existing mechanism to cover shipping
confirmations too, instead of inventing a new one.

## Current state

`src/pages/api/admin/mark-shipped.ts:145-157` — the email-failure path:
```ts
  // ── Send shipping confirmation to customer ────────────────────────────────
  try {
    await sendShippingConfirmation({ order, contact, trackingNumber, carrier });
    console.info(
      `[mark-shipped] Shipping confirmation sent for order ${orderId}`
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[mark-shipped] Failed to send shipping confirmation:`, err);
    return redirect(
      `/admin/orders/shipping?error=email&detail=${encodeURIComponent(detail)}`
    );
  }
```
At this point `order`, `contact` (a `PendingOrderContact` with
`fulfillmentMethod: 'shipping'`), `trackingNumber` (`string | undefined`),
and `carrier` (`string | undefined`) are all in scope — everything needed to
persist and later retry the send.

`src/lib/email/failedEmails.ts` (full file, 55 lines) currently has a
**single implicit email type** — every stored record assumes
order-confirmation:
```ts
export interface FailedEmailRecord {
  orderId: string;
  order: Order;
  contact: PendingOrderContact;
  failedAt: string; // ISO timestamp
  error: string;    // error message (no stack traces)
}

function getFailedEmailsStore() {
  return getStore({ name: "failed-emails", consistency: "strong" });
}

export async function storeFailedEmail(
  orderId: string,
  order: Order,
  contact: PendingOrderContact,
  error: unknown
): Promise<void> {
  const store = getFailedEmailsStore();
  const record: FailedEmailRecord = {
    orderId,
    order,
    contact,
    failedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  };
  await store.setJSON(orderId, record);
}
```
`getFailedEmail`, `listFailedEmails`, `deleteFailedEmail` are untouched by
this plan (their signatures don't need to change).

`src/pages/api/webhooks/square.ts:259` is the only existing caller of
`storeFailedEmail`, positionally: `storeFailedEmail(orderId, order, contact, emailErr)`.

`src/pages/api/admin/retry-failed-emails.ts` (full file, 51 lines) — the
`POST` handler is currently **hardcoded** to order-confirmation:
```ts
  try {
    await sendOrderConfirmation({ order: record.order, contact: record.contact });
    await deleteFailedEmail(orderId);
    ...
```
This must branch on the record's email type once this plan adds one.

`src/lib/email/sender.ts:77-82` — `sendShippingConfirmation`'s signature:
```ts
export async function sendShippingConfirmation({
  order,
  contact,
  trackingNumber,
  carrier,
}: ShippingConfirmationPayload): Promise<void> {
```

No admin UI page currently calls `GET`/`POST /api/admin/retry-failed-emails`
(confirmed via `grep -rln "retry-failed-emails\|FailedEmail" src/pages
src/components` — only the route, its tests, and the webhook caller match);
this plan does not add one either — it's out of scope, matching the existing
API-only shape of this feature.

## Commands you will need

| Purpose   | Command               | Expected on success |
|-----------|--------------------------|----------------------|
| Typecheck | `pnpm check`            | exit 0, no errors    |
| Tests     | `pnpm test:run`         | all pass             |
| Lint      | `pnpm lint`             | exit 0               |

## Scope

**In scope**:
- `src/lib/email/failedEmails.ts` — extend `FailedEmailRecord` and
  `storeFailedEmail`'s signature (backward-compatibly).
- `src/pages/api/admin/mark-shipped.ts` — call `storeFailedEmail` in the
  email-failure catch block.
- `src/pages/api/admin/retry-failed-emails.ts` — branch on email type in the
  `POST` handler.
- `src/pages/api/webhooks/square.ts` — only if its existing
  `storeFailedEmail(...)` call needs a signature-compatible adjustment (see
  Step 1 — it shouldn't, if the new parameter is optional and defaults
  correctly, but verify before assuming).
- New/updated test files: `src/lib/email/__tests__/failedEmails.test.ts` (if
  it exists — extend it; if not, this plan doesn't require creating one from
  scratch, see Test plan), `src/pages/api/admin/__tests__/retry-failed-emails.test.ts`,
  `src/pages/api/admin/__tests__/mark-shipped.test.ts`.

**Out of scope**:
- Building an admin UI page to browse/retry failed emails — this feature is
  API-only today; adding a UI is a separate, larger piece of work not
  requested here.
- Any change to the Square fulfillment state-machine walk
  (`mark-shipped.ts:86-143`) — untouched, this plan only touches the
  email-failure catch block after it.
- `sendShippingConfirmation`'s own implementation in `src/lib/email/sender.ts`
  — untouched.

## Git workflow

- Branch: `advisor/136-persist-failed-shipping-confirmation-emails`
- Commit per logical step, or one combined commit — operator's call.
- Commit message style: lowercase, conventional-ish prefix, e.g.
  `fix: persist failed shipping-confirmation emails for admin retry`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add an email-type discriminator to `FailedEmailRecord`

In `src/lib/email/failedEmails.ts`, extend the interface and
`storeFailedEmail`'s signature with a new optional 5th parameter carrying
type + shipping-specific fields, defaulting to today's behavior when
omitted (so the existing webhook call site at
`src/pages/api/webhooks/square.ts:259` keeps compiling and behaving
identically without any edit):

```ts
export interface FailedEmailRecord {
  orderId: string;
  order: Order;
  contact: PendingOrderContact;
  failedAt: string;
  error: string;
  emailType?: "order-confirmation" | "shipping-confirmation"; // defaults to "order-confirmation" when absent, for backward compatibility with records stored before this field existed
  trackingNumber?: string;
  carrier?: string;
}

export async function storeFailedEmail(
  orderId: string,
  order: Order,
  contact: PendingOrderContact,
  error: unknown,
  options?: {
    emailType?: "order-confirmation" | "shipping-confirmation";
    trackingNumber?: string;
    carrier?: string;
  }
): Promise<void> {
  const store = getFailedEmailsStore();
  const record: FailedEmailRecord = {
    orderId,
    order,
    contact,
    failedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    emailType: options?.emailType ?? "order-confirmation",
    trackingNumber: options?.trackingNumber,
    carrier: options?.carrier,
  };
  await store.setJSON(orderId, record);
}
```

**Verify**: `pnpm check` → 0 errors (confirms the existing positional call
at `webhooks/square.ts:259` still type-checks with the new optional 5th
parameter omitted).

### Step 2: Wire `mark-shipped.ts`'s email-failure path to persist

In `src/pages/api/admin/mark-shipped.ts`, change the catch block at lines
151-156 to persist before redirecting — matching the webhook handler's
existing "never let a Blob write failure mask the real error" pattern
(`src/pages/api/webhooks/square.ts:259-263`, `.catch()` on the persist call
itself so a *second* failure — the Blob write — doesn't throw past this
catch block):

```ts
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[mark-shipped] Failed to send shipping confirmation:`, err);
    await storeFailedEmail(orderId, order, contact, err, {
      emailType: 'shipping-confirmation',
      trackingNumber,
      carrier,
    }).catch((blobErr) => {
      console.error(
        `[mark-shipped] Failed to store retry record for ${orderId}:`,
        blobErr
      );
    });
    return redirect(
      `/admin/orders/shipping?error=email&detail=${encodeURIComponent(detail)}`
    );
  }
```

Add the import: `import { storeFailedEmail } from '@/lib/email/failedEmails';`

**Verify**: `pnpm check` → 0 errors.

### Step 3: Make the retry endpoint type-aware

In `src/pages/api/admin/retry-failed-emails.ts`, replace the hardcoded
`sendOrderConfirmation` call in the `POST` handler with a branch on
`record.emailType`:

```ts
  try {
    if (record.emailType === 'shipping-confirmation') {
      await sendShippingConfirmation({
        order: record.order,
        contact: record.contact,
        trackingNumber: record.trackingNumber,
        carrier: record.carrier,
      });
    } else {
      await sendOrderConfirmation({ order: record.order, contact: record.contact });
    }
    await deleteFailedEmail(orderId);
    ...
```

Add the import: `import { sendShippingConfirmation } from '@/lib/email/sender';`
(alongside the existing `sendOrderConfirmation` import).

**Verify**: `pnpm check` → 0 errors.

## Test plan

- `src/pages/api/admin/__tests__/mark-shipped.test.ts` — add a case: Square
  state-walk succeeds, `sendShippingConfirmation` rejects → assert
  `storeFailedEmail` was called with `emailType: 'shipping-confirmation'`
  and the tracking/carrier values, and the response still redirects with
  `?error=email` (unchanged customer-facing behavior — this plan adds
  persistence, doesn't change the redirect). Mock `@/lib/email/failedEmails`
  the same way other tests in this repo mock Blob-backed modules (see
  `src/pages/api/webhooks/__tests__/square.test.ts`'s mock of the same
  module for the pattern to follow).
- `src/pages/api/admin/__tests__/retry-failed-emails.test.ts` — add a case:
  `getFailedEmail` returns a record with `emailType: 'shipping-confirmation'`
  → assert `sendShippingConfirmation` (not `sendOrderConfirmation`) is
  called with the right tracking/carrier fields. Existing tests for the
  order-confirmation path (no `emailType`, or `emailType: 'order-confirmation'`)
  must keep passing unchanged — confirms the default branch still works.
- If `src/lib/email/__tests__/failedEmails.test.ts` exists, add a case
  confirming `storeFailedEmail` defaults `emailType` to
  `'order-confirmation'` when the new `options` parameter is omitted
  (backward compatibility with the webhook's existing 4-arg call). If it
  doesn't exist, creating one from scratch is optional — the two route-level
  test files above already exercise `storeFailedEmail`/`getFailedEmail`
  indirectly.

Verification: `pnpm test:run` → all pass, plus the new cases above.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0; new test cases for the shipping-confirmation
      failure path (in `mark-shipped.test.ts` and
      `retry-failed-emails.test.ts`) exist and pass
- [ ] `grep -n "storeFailedEmail" src/pages/api/admin/mark-shipped.ts` shows
      the new call
- [ ] `grep -n "sendShippingConfirmation" src/pages/api/admin/retry-failed-emails.ts`
      shows the new branch
- [ ] `src/pages/api/webhooks/square.ts`'s existing `storeFailedEmail(...)`
      call is unchanged (backward compatibility confirmed via `pnpm check`
      passing without editing that call site)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any of the "Current state" excerpts don't match the live files (drift).
- The webhook's existing `storeFailedEmail(orderId, order, contact, emailErr)`
  call site (`webhooks/square.ts:259`) fails to type-check after Step 1 —
  would mean the new parameter isn't truly backward-compatible; fix the
  signature so it is rather than editing the webhook call site (editing it
  is out of scope for this plan unless genuinely unavoidable — if so,
  report why before proceeding).
- You discover an admin UI page for failed-email retry already exists
  somewhere this plan's recon missed — adjust to also surface the new
  `emailType`/tracking fields there instead of leaving the UI showing
  stale/incomplete info, and note the expanded scope in your final report.

## Maintenance notes

- A future third email type (e.g. a back-in-stock notification failure)
  should follow this same pattern: extend the `emailType` union, add its
  optional fields to `FailedEmailRecord`, add a branch in
  `retry-failed-emails.ts`'s `POST` handler.
- No admin UI exists for this feature yet — if one gets built later, it
  should render `emailType` (and `trackingNumber`/`carrier` when present) so
  an admin can tell what kind of email is being retried before clicking.
