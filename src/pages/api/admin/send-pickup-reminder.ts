// src/pages/api/admin/send-pickup-reminder.ts
//
// Sends a pickup reminder email to the customer for a pending pickup order.
// Returns JSON so the calling button can show inline feedback without a page reload.
// No Square state is mutated — this only sends an email.

import type { APIRoute } from "astro";
import { ADMIN_COOKIE_NAME, isAuthenticated } from "@/lib/admin/auth";
import { squareClient } from "@/lib/square/client";
import { sendPickupReminderEmail } from "@/lib/email/sender";

const STORE_TIMEZONE = "America/Chicago";

function formatPickupAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
    timeZone: STORE_TIMEZONE, timeZoneName: "short",
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(request, cookies.get(ADMIN_COOKIE_NAME)?.value)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  let orderId: string;
  try {
    const body = await request.formData();
    orderId = (body.get("orderId") as string)?.trim();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_body" }), { status: 400 });
  }

  if (!orderId) {
    return new Response(JSON.stringify({ error: "missing_order_id" }), { status: 400 });
  }

  try {
    const orderResult = await squareClient.orders.get({ orderId });
    const order = orderResult.order;
    if (!order) throw new Error("Order not returned");

    const fulfillment = order.fulfillments?.find(
      (f: any) => f.type === "PICKUP" && f.state !== "COMPLETED" && f.state !== "CANCELED",
    );
    if (!fulfillment) {
      return new Response(JSON.stringify({ error: "no_active_pickup" }), { status: 422 });
    }

    const recipient = fulfillment.pickupDetails?.recipient;
    const email = recipient?.emailAddress;
    if (!email) {
      console.error(`[send-pickup-reminder] No email on fulfillment recipient for order ${orderId}`);
      return new Response(JSON.stringify({ error: "no_email" }), { status: 422 });
    }

    const customerName = recipient.displayName ?? "Customer";
    const pickupAtIso = fulfillment.pickupDetails?.pickupAt;
    const pickupAt = pickupAtIso ? formatPickupAt(pickupAtIso) : undefined;

    const items = (order.lineItems ?? [])
      .filter((li: any) => li.catalogObjectId)
      .map((li: any) => ({ name: li.name ?? "Item", qty: li.quantity ?? "1" }));

    await sendPickupReminderEmail({ to: email, customerName, orderId, items, pickupAt });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-pickup-reminder] Error:", message, err);
    return new Response(JSON.stringify({ error: "send_failed", detail: message }), { status: 500 });
  }
};
