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

import type { APIRoute } from "astro";
import { ADMIN_COOKIE_NAME, isAuthenticated } from "@/lib/admin/auth";
import { SquareClient, SquareEnvironment } from "square-legacy";
import { sendShippingConfirmation } from "@/lib/email/sender";
import type { PendingOrderContact } from "@/lib/email/pendingOrders";

const SHIPMENT_STATES = ["PROPOSED", "RESERVED", "COMPLETED"] as const;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // ── Auth check ────────────────────────────────────────────────────────────
  if (!isAuthenticated(request, cookies.get(ADMIN_COOKIE_NAME)?.value)) {
    return redirect("/admin/login?from=/admin/orders");
  }

  // ── Parse form body ───────────────────────────────────────────────────────
  let orderId: string;
  let trackingNumber: string | undefined;
  let carrier: string | undefined;

  try {
    const body = await request.formData();
    orderId = (body.get("orderId") as string)?.trim();
    trackingNumber = (body.get("trackingNumber") as string)?.trim() || undefined;
    carrier = (body.get("carrier") as string)?.trim() || undefined;
  } catch {
    return new Response("Invalid form data", { status: 400 });
  }

  if (!orderId) return new Response("Missing orderId", { status: 400 });

  // ── Square client ─────────────────────────────────────────────────────────
  const client = new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment:
      import.meta.env.PUBLIC_SQUARE_ENVIRONMENT === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
  });

  // ── Fetch the live order — get fulfillmentUid, current state, customer info ─
  let fulfillmentUid: string;
  let currentState: string;
  let locationId: string;
  let customerEmail: string;
  let customerName: string;
  let order: import("square-legacy").Order;

  try {
    const orderResult = await client.orders.get({ orderId });
    if (!orderResult.order) throw new Error("Order not returned");
    order = orderResult.order;

    locationId = order.locationId ?? import.meta.env.PUBLIC_SQUARE_LOCATION_ID;

    const fulfillment = order.fulfillments?.find(
      (f: any) => f.type === "SHIPMENT" && f.state !== "COMPLETED" && f.state !== "CANCELED"
    );
    if (!fulfillment?.uid) throw new Error("No active SHIPMENT fulfillment found");

    fulfillmentUid = fulfillment.uid;
    currentState = fulfillment.state ?? "PROPOSED";

    const recipient = fulfillment.shipmentDetails?.recipient;
    if (!recipient?.emailAddress || !recipient?.displayName) {
      throw new Error("No customer email on shipment recipient");
    }
    customerEmail = recipient.emailAddress;
    customerName = recipient.displayName;
  } catch (err) {
    console.error(`[mark-shipped] Failed to retrieve order ${orderId}:`, err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("No customer email")) {
      return redirect("/admin/orders/shipping?error=no-email");
    }
    return redirect("/admin/orders/shipping?error=fetch");
  }

  const contact: PendingOrderContact = {
    email: customerEmail,
    name: customerName,
    fulfillmentMethod: "shipping",
  };

  // ── Walk the state machine to COMPLETED ───────────────────────────────────
  // Square requires sequential transitions — skipping states is rejected.
  const currentIdx = SHIPMENT_STATES.indexOf(currentState as typeof SHIPMENT_STATES[number]);
  const targetIdx = SHIPMENT_STATES.indexOf("COMPLETED");
  const steps = SHIPMENT_STATES.slice(Math.max(currentIdx + 1, 0), targetIdx + 1);

  try {
    for (const targetState of steps) {
      // Re-fetch the version before each step — it increments on every update.
      const refreshed = await client.orders.get({ orderId });
      if (!refreshed.order) throw new Error("Order not found on refresh");

      // Only attach tracking/carrier on the final COMPLETED transition.
      const shipmentDetails =
        targetState === "COMPLETED" && (trackingNumber || carrier)
          ? {
              ...(trackingNumber ? { trackingNumber } : {}),
              ...(carrier ? { carrier } : {}),
            }
          : undefined;

      await client.orders.update({
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
    const squareErrors = (err as any)?.errors;
    const detail = squareErrors?.[0]?.detail
      ?? squareErrors?.[0]?.code
      ?? (err as Error)?.message
      ?? "unknown";
    console.error(`[mark-shipped] Square update failed for ${orderId}:`, JSON.stringify(err, null, 2));
    return redirect(`/admin/orders/shipping?error=update&detail=${encodeURIComponent(detail)}`);
  }

  // ── Send shipping confirmation to customer ────────────────────────────────
  try {
    await sendShippingConfirmation({ order, contact, trackingNumber, carrier });
    console.log(`[mark-shipped] Shipping confirmation sent for order ${orderId}`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[mark-shipped] Failed to send shipping confirmation:`, err);
    return redirect(`/admin/orders/shipping?error=email&detail=${encodeURIComponent(detail)}`);
  }

  return redirect(`/admin/orders/shipping?shipped=1&shippedId=${orderId}`);
};
