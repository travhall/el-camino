// src/pages/api/admin/dismiss-order.ts
//
// Marks an order as dismissed in the admin UI. The order is hidden from
// pending lists but Square is not modified. Accepts an optional `from`
// field to redirect back to the correct tab (shipping or pickups).

import type { APIRoute } from "astro";
import { isAdminAuthenticated, parseAdminFormData } from "@/lib/admin/auth";
import { dismissOrder } from "@/lib/admin/dismissedOrders";


export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isAdminAuthenticated(request, cookies)) {
    return redirect("/admin/login");
  }

  const body = await parseAdminFormData(request);
  if (!body) return new Response("Invalid form data", { status: 400 });

  const orderId = (body.get("orderId") as string)?.trim();
  let from = (body.get("from") as string)?.trim() || "/admin/orders/pickups";
  // Validate redirect target
  if (!from.startsWith("/admin/orders/")) from = "/admin/orders/pickups";

  if (!orderId) return new Response("Missing orderId", { status: 400 });

  await dismissOrder(orderId);

  return redirect(`${from}?dismissed=1`);
};
