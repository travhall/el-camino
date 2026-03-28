// src/pages/api/admin/dismiss-order.ts
//
// Marks an order as dismissed in the admin UI. The order is hidden from
// pending lists but Square is not modified. Accepts an optional `from`
// field to redirect back to the correct tab (shipping or pickups).

import type { APIRoute } from "astro";
import { createHmac } from "node:crypto";
import { dismissOrder } from "@/lib/admin/dismissedOrders";

const COOKIE_NAME = "admin_session";

function expectedToken(secret: string): string {
  return createHmac("sha256", secret).update("admin:authenticated").digest("hex");
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return new Response("Admin not configured", { status: 503 });

  const sessionToken = cookies.get(COOKIE_NAME)?.value ?? "";
  if (sessionToken !== expectedToken(secret)) {
    return redirect("/admin/login");
  }

  let orderId: string;
  let from: string;

  try {
    const body = await request.formData();
    orderId = (body.get("orderId") as string)?.trim();
    from = (body.get("from") as string)?.trim() || "/admin/orders/pickups";
    // Validate redirect target
    if (!from.startsWith("/admin/orders/")) from = "/admin/orders/pickups";
  } catch {
    return new Response("Invalid form data", { status: 400 });
  }

  if (!orderId) return new Response("Missing orderId", { status: 400 });

  await dismissOrder(orderId);

  return redirect(`${from}?dismissed=1`);
};
