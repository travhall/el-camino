// src/pages/api/admin/mark-pickedup.ts
//
// Marks a Square pickup order fulfillment as COMPLETED (customer collected).
//
// Square enforces a strict state machine for PICKUP fulfillments:
//   PROPOSED → RESERVED → PREPARED → COMPLETED
// Jumping directly to COMPLETED is rejected, so we walk through each
// intermediate state. The version is re-fetched before every step because
// Square increments it on each successful update.

import type { APIRoute } from "astro";
import { createHmac } from "node:crypto";
import { Client, Environment } from "square/legacy";

const COOKIE_NAME = "admin_session";
const PICKUP_STATES = ["PROPOSED", "RESERVED", "PREPARED", "COMPLETED"] as const;

function expectedToken(secret: string): string {
  return createHmac("sha256", secret).update("admin:authenticated").digest("hex");
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return new Response("Admin not configured", { status: 503 });

  const sessionToken = cookies.get(COOKIE_NAME)?.value ?? "";
  if (sessionToken !== expectedToken(secret)) {
    return redirect("/admin/login?from=/admin/orders/pickups");
  }

  let orderId: string;
  try {
    const body = await request.formData();
    orderId = (body.get("orderId") as string)?.trim();
  } catch {
    return new Response("Invalid form data", { status: 400 });
  }

  if (!orderId) return new Response("Missing orderId", { status: 400 });

  const client = new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN!,
    environment: import.meta.env.PUBLIC_SQUARE_ENVIRONMENT === "production"
      ? Environment.Production : Environment.Sandbox,
  });

  // Fetch the live order to get current fulfillment state and UID.
  let fulfillmentUid: string;
  let currentState: string;
  let locationId: string;

  try {
    const { result } = await client.ordersApi.retrieveOrder(orderId);
    const order = result.order;
    if (!order) throw new Error("Order not returned");

    locationId = order.locationId ?? import.meta.env.PUBLIC_SQUARE_LOCATION_ID;

    const fulfillment = order.fulfillments?.find(
      (f) => f.type === "PICKUP" && f.state !== "COMPLETED" && f.state !== "CANCELED"
    );
    if (!fulfillment?.uid) throw new Error("No active PICKUP fulfillment found");

    fulfillmentUid = fulfillment.uid;
    currentState = fulfillment.state ?? "PROPOSED";
  } catch (err) {
    console.error(`[mark-pickedup] Failed to retrieve order ${orderId}:`, err);
    return redirect("/admin/orders/pickups?error=fetch");
  }

  // Walk through each required intermediate state to reach COMPLETED.
  // Square requires sequential transitions — skipping states is rejected.
  const currentIdx = PICKUP_STATES.indexOf(currentState as typeof PICKUP_STATES[number]);
  const targetIdx = PICKUP_STATES.indexOf("COMPLETED");
  const steps = PICKUP_STATES.slice(
    Math.max(currentIdx + 1, 0),
    targetIdx + 1
  );

  try {
    for (const targetState of steps) {
      // Re-fetch the version before each step — it increments on every update.
      const { result: refreshed } = await client.ordersApi.retrieveOrder(orderId);
      if (!refreshed.order) throw new Error("Order not found on refresh");

      await client.ordersApi.updateOrder(orderId, {
        // Stable idempotency key per state — safe to retry if a step fails.
        idempotencyKey: `pickedup-${orderId}-${targetState}`,
        order: {
          locationId,
          version: refreshed.order.version ?? 1,
          fulfillments: [{ uid: fulfillmentUid, state: targetState }],
        },
      });
    }
  } catch (err) {
    const squareErrors = (err as any)?.errors;
    const detail = squareErrors?.[0]?.detail
      ?? squareErrors?.[0]?.code
      ?? (err as Error)?.message
      ?? "unknown";
    console.error(`[mark-pickedup] Square update failed for ${orderId}:`, JSON.stringify(err, null, 2));
    return redirect(`/admin/orders/pickups?error=update&detail=${encodeURIComponent(detail)}`);
  }

  return redirect(`/admin/orders/pickups?completed=1&completedId=${orderId}`);
};
