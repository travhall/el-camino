// src/pages/api/admin/mark-shipped.ts
//
// Marks a Square shipping order as fulfilled, then sends the customer a
// shipping confirmation email (with optional tracking number).
//
// Square enforces a strict state machine for SHIPMENT fulfillments:
//   PROPOSED → RESERVED → COMPLETED
// Jumping directly to COMPLETED is rejected, so we walk through each
// intermediate state. The version is re-fetched before every step because
// Square increments it on each successful update.

import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { isAdminAuthenticated, parseAdminFormData } from '@/lib/admin/auth';
import { squareClient } from '@/lib/square/client';
import { sendShippingConfirmation } from '@/lib/email/sender';
import { storeFailedEmail } from '@/lib/email/failedEmails';
import type { PendingOrderContact } from '@/lib/email/pendingOrders';
import type { Fulfillment, SquareError } from 'square-legacy';

const SHIPMENT_STATES = ['PROPOSED', 'RESERVED', 'COMPLETED'] as const;

// Square silently discards a retried update under a repeated idempotency key
// (confirmed against sandbox: the second call returns 200 with the cached
// first-call response — no error, no change applied). A key derived from the
// tracking payload itself makes each distinct correction its own operation,
// while an accidental double-submit of the same correction still dedupes.
function amendIdempotencyKey(
  orderId: string,
  trackingNumber: string | undefined,
  carrier: string | undefined
): string {
  const hash = createHash('sha256')
    .update(`${orderId}:${trackingNumber ?? ''}:${carrier ?? ''}`)
    .digest('hex')
    .slice(0, 32);
  return `amend-${hash}`;
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // ── Auth check ────────────────────────────────────────────────────────────
  if (!isAdminAuthenticated(request, cookies)) {
    return redirect('/admin/login?from=/admin/orders');
  }

  // ── Parse form body ───────────────────────────────────────────────────────
  const body = await parseAdminFormData(request);
  if (!body) return new Response('Invalid form data', { status: 400 });

  const orderId = (body.get('orderId') as string)?.trim();
  const trackingNumber =
    (body.get('trackingNumber') as string)?.trim() || undefined;
  const carrier = (body.get('carrier') as string)?.trim() || undefined;

  if (!orderId) return new Response('Missing orderId', { status: 400 });

  // ── Fetch the live order — get fulfillmentUid, current state, customer info ─
  let fulfillmentUid: string;
  let currentState: string;
  let locationId: string;
  let customerEmail: string;
  let customerName: string;
  let order: import('square-legacy').Order;

  try {
    const orderResult = await squareClient.orders.get({ orderId });
    if (!orderResult.order) throw new Error('Order not returned');
    order = orderResult.order;

    locationId = order.locationId ?? import.meta.env.PUBLIC_SQUARE_LOCATION_ID;

    // Accepts COMPLETED shipments too — the amend path below corrects
    // tracking on an already-shipped order. CANCELED is still excluded.
    const fulfillment = order.fulfillments?.find(
      (f: Fulfillment) => f.type === 'SHIPMENT' && f.state !== 'CANCELED'
    );
    if (!fulfillment?.uid)
      throw new Error('No active SHIPMENT fulfillment found');

    fulfillmentUid = fulfillment.uid;
    currentState = fulfillment.state ?? 'PROPOSED';

    const recipient = fulfillment.shipmentDetails?.recipient;
    if (!recipient?.emailAddress || !recipient?.displayName) {
      throw new Error('No customer email on shipment recipient');
    }
    customerEmail = recipient.emailAddress;
    customerName = recipient.displayName;
  } catch (err) {
    console.error(`[mark-shipped] Failed to retrieve order ${orderId}:`, err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('No customer email')) {
      return redirect('/admin/orders/shipping?error=no-email');
    }
    return redirect('/admin/orders/shipping?error=fetch');
  }

  const contact: PendingOrderContact = {
    email: customerEmail,
    name: customerName,
    fulfillmentMethod: 'shipping',
  };

  // ── Amend path: correct tracking on an already-shipped order ──────────────
  // Distinct from the state walk below — it targets a fulfillment that's
  // already COMPLETED, so there's no state to walk. Does not re-send the
  // shipping confirmation email (see plan 173, Step 3): a corrected tracking
  // number might be welcome, but re-sending the same email could read as a
  // second shipment notice. That's the operator's call to revisit later.
  if (currentState === 'COMPLETED') {
    try {
      await squareClient.orders.update({
        orderId,
        // Keyed on the tracking payload, not a fixed state — each distinct
        // correction is a distinct operation, while re-submitting the same
        // correction still dedupes.
        idempotencyKey: amendIdempotencyKey(orderId, trackingNumber, carrier),
        order: {
          locationId,
          version: order.version ?? 1,
          fulfillments: [
            {
              uid: fulfillmentUid,
              state: 'COMPLETED',
              shipmentDetails: {
                ...(trackingNumber ? { trackingNumber } : {}),
                ...(carrier ? { carrier } : {}),
              },
            },
          ],
        },
      });
    } catch (err) {
      const squareErrors = (err as SquareError)?.errors;
      const detail =
        squareErrors?.[0]?.detail ??
        squareErrors?.[0]?.code ??
        (err as Error)?.message ??
        'unknown';
      console.error(
        `[mark-shipped] Square amend failed for ${orderId}:`,
        JSON.stringify(err, null, 2)
      );
      return redirect(
        `/admin/orders/shipping?error=update&detail=${encodeURIComponent(detail)}`
      );
    }

    return redirect(`/admin/orders/shipping?shipped=1&shippedId=${orderId}`);
  }

  // ── Walk the state machine to COMPLETED ───────────────────────────────────
  // Square requires sequential transitions — skipping states is rejected.
  const currentIdx = SHIPMENT_STATES.indexOf(
    currentState as (typeof SHIPMENT_STATES)[number]
  );
  const targetIdx = SHIPMENT_STATES.indexOf('COMPLETED');
  const steps = SHIPMENT_STATES.slice(
    Math.max(currentIdx + 1, 0),
    targetIdx + 1
  );

  try {
    for (const targetState of steps) {
      // Re-fetch the version before each step — it increments on every update.
      const refreshed = await squareClient.orders.get({ orderId });
      if (!refreshed.order) throw new Error('Order not found on refresh');

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
        order: {
          locationId,
          version: refreshed.order.version ?? 1,
          fulfillments: [
            {
              uid: fulfillmentUid,
              state: targetState,
              ...(shipmentDetails ? { shipmentDetails } : {}),
            },
          ],
        },
      });
    }
  } catch (err) {
    const squareErrors = (err as SquareError)?.errors;
    const detail =
      squareErrors?.[0]?.detail ??
      squareErrors?.[0]?.code ??
      (err as Error)?.message ??
      'unknown';
    console.error(
      `[mark-shipped] Square update failed for ${orderId}:`,
      JSON.stringify(err, null, 2)
    );
    return redirect(
      `/admin/orders/shipping?error=update&detail=${encodeURIComponent(detail)}`
    );
  }

  // ── Send shipping confirmation to customer ────────────────────────────────
  try {
    await sendShippingConfirmation({ order, contact, trackingNumber, carrier });
    console.info(
      `[mark-shipped] Shipping confirmation sent for order ${orderId}`
    );
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

  return redirect(`/admin/orders/shipping?shipped=1&shippedId=${orderId}`);
};
