// src/pages/api/admin/mark-pickedup.ts
//
// Marks a Square pickup order fulfillment as COMPLETED (customer collected).
// No email is sent — the customer already received their confirmation.

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
  let fulfillmentUid: string;
  let orderVersion: number;

  try {
    const body = await request.formData();
    orderId = (body.get("orderId") as string)?.trim();
    fulfillmentUid = (body.get("fulfillmentUid") as string)?.trim();
    orderVersion = parseInt((body.get("orderVersion") as string) ?? "1", 10);
  } catch {
    return new Response("Invalid form data", { status: 400 });
  }

  if (!orderId || !fulfillmentUid) {
    return new Response("Missing orderId or fulfillmentUid", { status: 400 });
  }

  const client = new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN!,
    environment: import.meta.env.PUBLIC_SQUARE_ENVIRONMENT === "production"
      ? Environment.Production : Environment.Sandbox,
  });

  try {
    await client.ordersApi.updateOrder(orderId, {
      idempotencyKey: `pickedup-${orderId}-${Date.now()}`,
      order: {
        locationId: import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
        version: orderVersion,
        fulfillments: [{
          uid: fulfillmentUid,
          state: "COMPLETED",
          pickupDetails: { pickedUpAt: new Date().toISOString() },
        }],
      },
    });
  } catch (err) {
    console.error(`[mark-pickedup] Square update failed for order ${orderId}:`, err);
    return redirect("/admin/orders/pickups?error=1");
  }

  return redirect("/admin/orders/pickups?completed=1");
};
