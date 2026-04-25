// src/pages/api/admin/dismiss-order.ts
//
// Marks an order as dismissed in the admin UI. The order is hidden from
// pending lists but Square is not modified. Accepts an optional `from`
// field to redirect back to the correct tab (shipping or pickups).

import type { APIRoute } from "astro";
import { ADMIN_COOKIE_NAME, isAuthenticated } from "@/lib/admin/auth";
import { dismissOrder } from "@/lib/admin/dismissedOrders";


export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isAuthenticated(request, cookies.get(ADMIN_COOKIE_NAME)?.value)) {
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
