// src/pages/api/admin/mark-pickedup.ts
//
// Marks a Square pickup order fulfillment as COMPLETED (customer collected).
// Fetches the live order to get the current version — avoids version-mismatch
// errors when the order was updated between page load and form submission.

import type { APIRoute } from "astro";
import { createHmac } from "node:crypto";
import { Client, Environment } from "square/legacy";

const COOKIE_NAME = "admin_session";

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

  // Fetch the live order to get the current version and fulfillment UID.
  // Using stale values from the form causes version-conflict errors.
  let currentVersion: number;
  let fulfillmentUid: string;
  let locationId: string;

  try {
    const { result } = await client.ordersApi.retrieveOrder(orderId);
    const order = result.order;
    if (!order) throw new Error("Order not returned");

    currentVersion = order.version ?? 1;
    locationId = order.locationId ?? import.meta.env.PUBLIC_SQUARE_LOCATION_ID;

    const fulfillment = order.fulfillments?.find(
      (f) => f.type === "PICKUP" && f.state !== "COMPLETED"
    );
    if (!fulfillment?.uid) throw new Error("No active PICKUP fulfillment found");
    fulfillmentUid = fulfillment.uid;
  } catch (err) {
    console.error(`[mark-pickedup] Failed to retrieve order ${orderId}:`, err);
    return redirect("/admin/orders/pickups?error=fetch");
  }

  try {
    await client.ordersApi.updateOrder(orderId, {
      idempotencyKey: `pickedup-${orderId}-${Date.now()}`,
      order: {
        locationId,
        version: currentVersion,
        fulfillments: [{ uid: fulfillmentUid, state: "COMPLETED" }],
      },
    });
  } catch (err) {
    console.error(`[mark-pickedup] Square update failed for order ${orderId}:`, err);
    return redirect("/admin/orders/pickups?error=update");
  }

  return redirect("/admin/orders/pickups?completed=1");
};
