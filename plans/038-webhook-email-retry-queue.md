# Plan 038: Persist failed webhook email deliveries for admin retry

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0da82aa..HEAD -- src/pages/api/webhooks/square.ts src/lib/email/`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `0da82aa`, 2026-07-22

## Why this matters

When the `sendOrderConfirmation` call inside the Square webhook handler throws
(e.g., Resend is momentarily unavailable), the outer catch logs the error and
returns HTTP 200. Square marks delivery successful and never retries. The
customer receives no order confirmation. The pickup/shipping notification to the
shop owner also never fires. The pending-order Netlify Blob remains intact
(because `deletePendingOrder` is skipped), but nothing re-reads it.

The existing 200-always-return design is intentional and correct: non-200 would
cause Square to retry the webhook with exponential backoff, potentially re-sending
emails for already-completed orders. The fix preserves that invariant while
adding a safety net: on email failure, write the failed delivery to a Netlify
Blob so the shop owner can surface and retry it from the admin UI.

## Current state

**`src/pages/api/webhooks/square.ts`** (relevant section, lines 199–232):

```typescript
try {
  await sendOrderConfirmation({ order, contact });
} catch (emailErr) {
  console.error(`[Webhook/Square] sendOrderConfirmation FAILED:`, emailErr);
  throw emailErr; // re-throws to outer catch
}

if (contact.fulfillmentMethod === "pickup") {
  await sendPickupNotification({ order, contact });
} else if (contact.fulfillmentMethod === "shipping") {
  await sendShippingOrderNotification({ order, contact });
}

await deletePendingOrder(orderId);

// ... outer catch:
} catch (err) {
  console.error(`[Webhook/Square] Error handling event "${eventType}":`, err);
  // Returns 200 to prevent Square retry flooding
}
return new Response(JSON.stringify({ received: true }), { status: 200, ... });
```

**`src/lib/email/pendingOrders.ts`** — manages Netlify Blobs for pending order
contacts. Use this file as the pattern for a new `failedEmails.ts` module.

**`src/lib/cache/blobCache.ts`** and Netlify Blobs are already imported/available
in this codebase. The blob store name used by pending orders is `"pending-orders"`.

**Pattern for a new blob module**: The `pendingOrders.ts` file exports
`storePendingOrder`, `getPendingOrder`, `deletePendingOrder`. Mirror this
pattern for the new `failedEmails.ts` module.

## Commands you will need

| Purpose   | Command        | Expected on success       |
|-----------|----------------|---------------------------|
| Typecheck | `pnpm check`   | exit 0, no errors         |
| Unit tests | `pnpm test:run` | all pass                 |

## Scope

**In scope**:
- `src/lib/email/failedEmails.ts` (create new)
- `src/pages/api/webhooks/square.ts` — wrap email sends; call `storeFailedEmail` on failure
- `src/pages/api/admin/retry-failed-emails.ts` (create new) — admin endpoint to list and retry

**Out of scope**:
- `src/pages/admin/` UI — this plan adds the API endpoint only; a UI page is a follow-up
- `src/lib/email/pendingOrders.ts` — do not modify; use as read-only reference
- The 200-always-return behavior — do NOT change this; it is intentional

## Git workflow

- Branch: `advisor/038-webhook-email-retry-queue`
- Commit message: `feat: persist failed webhook email deliveries for admin retry`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Create `src/lib/email/failedEmails.ts`

Read `src/lib/email/pendingOrders.ts` first to understand the Netlify Blobs
pattern, then create a new file `src/lib/email/failedEmails.ts`:

```typescript
// Stores failed webhook email delivery records in Netlify Blobs
// so the shop owner can surface and retry them from the admin UI.
import { getStore } from "@netlify/blobs";
import type { Order } from "square-legacy";
import type { PendingOrderContact } from "./pendingOrders";

interface FailedEmailRecord {
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

export async function getFailedEmail(orderId: string): Promise<FailedEmailRecord | null> {
  const store = getFailedEmailsStore();
  return await store.get(orderId, { type: "json" });
}

export async function listFailedEmails(): Promise<FailedEmailRecord[]> {
  const store = getFailedEmailsStore();
  const { blobs } = await store.list();
  const records = await Promise.all(
    blobs.map((b) => store.get(b.key, { type: "json" }) as Promise<FailedEmailRecord>)
  );
  return records.filter(Boolean);
}

export async function deleteFailedEmail(orderId: string): Promise<void> {
  const store = getFailedEmailsStore();
  await store.delete(orderId);
}
```

**Verify**: `pnpm check` → exit 0 after creating the file

### Step 2: Update the webhook handler to catch email failures

In `src/pages/api/webhooks/square.ts`, replace the inner try-catch around
`sendOrderConfirmation` with a pattern that catches the failure, stores it to
the retry queue, and continues (instead of re-throwing to the outer catch):

```typescript
import { storeFailedEmail } from "@/lib/email/failedEmails";

// Replace the inner try { await sendOrderConfirmation... } catch block with:
try {
  await sendOrderConfirmation({ order, contact });
  console.log(`[Webhook/Square] Confirmation email sent to ${contact.email}`);

  // Only send secondary notifications if the primary succeeded
  if (contact.fulfillmentMethod === "pickup") {
    await sendPickupNotification({ order, contact });
  } else if (contact.fulfillmentMethod === "shipping") {
    await sendShippingOrderNotification({ order, contact });
  }

  await deletePendingOrder(orderId);
  console.log(`[Webhook/Square] All emails sent for order: ${orderId}`);
} catch (emailErr) {
  console.error(`[Webhook/Square] Email delivery failed for order ${orderId}:`, emailErr);
  // Persist for admin retry — do NOT re-throw (would mask the 200 response)
  await storeFailedEmail(orderId, order, contact, emailErr).catch((blobErr) => {
    console.error(`[Webhook/Square] Failed to store retry record:`, blobErr);
  });
  // Pending order blob intentionally NOT deleted — idempotency guard stays intact
}
```

**Important**: Remove the `throw emailErr` line and do NOT let email failures
propagate to the outer catch. The outer catch is for Square signature
verification and deserialization failures — not email delivery failures.

**Verify**: `pnpm check` → exit 0

### Step 3: Create admin retry endpoint

Create `src/pages/api/admin/retry-failed-emails.ts`:

```typescript
import type { APIRoute } from "astro";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  listFailedEmails,
  deleteFailedEmail,
} from "@/lib/email/failedEmails";
import { sendOrderConfirmation } from "@/lib/email/sender";

// GET: list all failed email delivery records
export const GET: APIRoute = async ({ request }) => {
  if (!isAdminAuthenticated(request)) {
    return new Response(null, { status: 302, headers: { Location: "/admin/login" } });
  }
  const failed = await listFailedEmails();
  return new Response(JSON.stringify({ success: true, failed }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

// POST: retry a specific failed email by orderId
export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthenticated(request)) {
    return new Response(null, { status: 302, headers: { Location: "/admin/login" } });
  }
  const { orderId } = await request.json();
  if (!orderId) {
    return new Response(JSON.stringify({ error: "Missing orderId" }), { status: 400 });
  }

  // Import dynamically to read the current record
  const { getFailedEmail } = await import("@/lib/email/failedEmails");
  const record = await getFailedEmail(orderId);
  if (!record) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }

  try {
    await sendOrderConfirmation({ order: record.order, contact: record.contact });
    await deleteFailedEmail(orderId);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500 }
    );
  }
};
```

**Verify**: `pnpm check` → exit 0

### Step 4: Typecheck and tests

**Verify**: `pnpm check` → exit 0

**Verify**: `pnpm test:run` → all pass

## Test plan

Add `src/lib/email/failedEmails.test.ts`:
- Mock `@netlify/blobs` (same pattern as `blobCache.test.ts` if it exists, or mock
  `getStore` to return a fake store with `setJSON`, `get`, `list`, `delete` methods)
- Test `storeFailedEmail` writes the correct shape
- Test `listFailedEmails` returns empty array when store is empty
- Test `deleteFailedEmail` removes the record

Pattern to follow: look at how other Netlify Blobs-dependent modules are tested
in this repo (check `src/lib/` for `*.test.ts` files that mock the Blobs store).

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `src/lib/email/failedEmails.ts` exists with `storeFailedEmail`, `listFailedEmails`, `getFailedEmail`, `deleteFailedEmail`
- [ ] `src/pages/api/webhooks/square.ts` no longer re-throws email errors
- [ ] `src/pages/api/admin/retry-failed-emails.ts` exists with GET + POST handlers
- [ ] Both admin endpoints check `isAdminAuthenticated` before proceeding
- [ ] The webhook still returns HTTP 200 in all cases (no behavior change for Square)
- [ ] `plans/README.md` status row for 038 updated to DONE

## STOP conditions

- `@netlify/blobs` `getStore` API has changed since `pendingOrders.ts` was written —
  check `pendingOrders.ts` for the current import and usage patterns; mirror those
  exactly rather than guessing.
- The webhook's outer catch block structure has changed — if `deletePendingOrder`
  is now called unconditionally (moved outside the inner block), adjust accordingly.
- `isAdminAuthenticated` has a different signature than what's used in other admin
  routes — check `src/pages/api/admin/shop-status.ts` for the current import and
  call pattern.

## Maintenance notes

- The retry endpoint sends only the order confirmation email — it does not re-send
  the pickup/shipping admin notification. If that's needed, extend the stored record
  with the notification type and add retry logic for secondary emails.
- The `failed-emails` Netlify Blobs store will accumulate entries indefinitely if
  the admin never retries them. Consider adding a TTL or a cleanup cron in a
  follow-up.
- A simple admin UI page at `/admin/notifications/failed-emails` would surface the
  `GET /api/admin/retry-failed-emails` data; this plan intentionally omits the UI
  to keep scope small.
