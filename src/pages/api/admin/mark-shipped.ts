// src/pages/api/admin/mark-shipped.ts
//
// Marks a Square shipping order as fulfilled, then sends the customer a
// shipping confirmation email (with optional tracking number).
//
// Auth: validates the admin_session cookie directly (same logic as middleware)
// since this endpoint lives under /api/, not /admin/.

import type { APIRoute } from "astro";
import { createHmac } from "node:crypto";
import { Client, Environment } from "square/legacy";
import { sendShippingConfirmation } from "@/lib/email/sender";
import type { PendingOrderContact } from "@/lib/email/pendingOrders";

const COOKIE_NAME = "admin_session";

function expectedToken(secret: string): string {
  return createHmac("sha256", secret).update("admin:authenticated").digest("hex");
}


export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // ── Auth check ────────────────────────────────────────────────────────────
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return new Response("Admin not configured", { status: 503 });
  }

  const sessionToken = cookies.get(COOKIE_NAME)?.value ?? "";
  if (sessionToken !== expectedToken(secret)) {
    return redirect("/admin/login?from=/admin/orders");
  }

  // ── Parse form body ───────────────────────────────────────────────────────
  let orderId: string;
  let fulfillmentUid: string;
  let orderVersion: number;
  let trackingNumber: string | undefined;
  let carrier: string | undefined;

  try {
    const body = await request.formData();
    orderId = (body.get("orderId") as string)?.trim();
    fulfillmentUid = (body.get("fulfillmentUid") as string)?.trim();
    orderVersion = parseInt((body.get("orderVersion") as string) ?? "1", 10);
    trackingNumber = (body.get("trackingNumber") as string)?.trim() || undefined;
    carrier = (body.get("carrier") as string)?.trim() || undefined;
  } catch {
    return new Response("Invalid form data", { status: 400 });
  }

  if (!orderId || !fulfillmentUid) {
    return new Response("Missing orderId or fulfillmentUid", { status: 400 });
  }

  // ── Square client ─────────────────────────────────────────────────────────
  const client = new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN!,
    environment:
      import.meta.env.PUBLIC_SQUARE_ENVIRONMENT === "production"
        ? Environment.Production
        : Environment.Sandbox,
  });

  // ── Fetch the full order (need customer email + line items for email) ──────
  let order: import("square/legacy").Order;
  try {
    const { result } = await client.ordersApi.retrieveOrder(orderId);
    if (!result.order) throw new Error("Order not returned");
    order = result.order;
  } catch (err) {
    console.error(`[mark-shipped] Failed to retrieve order ${orderId}:`, err);
    return redirect("/admin/orders/shipping?error=fetch");
  }

  // Extract customer contact from the shipment recipient (set during checkout)
  const fulfillment = order.fulfillments?.find((f) => f.uid === fulfillmentUid);
  const recipient = fulfillment?.shipmentDetails?.recipient;
  const customerEmail = recipient?.emailAddress;
  const customerName = recipient?.displayName;

  if (!customerEmail || !customerName) {
    console.error(`[mark-shipped] No customer email on order ${orderId}`);
    return redirect("/admin/orders/shipping?error=no-email");
  }

  const contact: PendingOrderContact = {
    email: customerEmail,
    name: customerName,
    fulfillmentMethod: "shipping",
  };

  // ── Update fulfillment state to COMPLETED in Square ───────────────────────
  try {
    await client.ordersApi.updateOrder(orderId, {
      idempotencyKey: `shipped-${orderId}-${Date.now()}`,
      order: {
        locationId: order.locationId ?? import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
        version: orderVersion,
        fulfillments: [
          {
            uid: fulfillmentUid,
            state: "COMPLETED",
            shipmentDetails: {
              shippedAt: new Date().toISOString(),
              ...(trackingNumber ? { trackingNumber } : {}),
              ...(carrier ? { carrier } : {}),
            },
          },
        ],
      },
    });
  } catch (err) {
    // Log but don't block — still send the customer email
    console.error(`[mark-shipped] Square update failed for order ${orderId}:`, err);
  }

  // ── Send shipping confirmation to customer ────────────────────────────────
  try {
    await sendShippingConfirmation({ order, contact, trackingNumber, carrier });
    console.log(`[mark-shipped] Shipping confirmation sent for order ${orderId}`);
  } catch (err) {
    console.error(`[mark-shipped] Failed to send shipping confirmation:`, err);
    return redirect("/admin/orders/shipping?error=email");
  }

  return redirect("/admin/orders/shipping?shipped=1");
};
