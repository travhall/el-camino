// src/pages/api/admin/remove-back-in-stock.ts
// Silently removes all back-in-stock subscribers for a product without
// sending any notification emails. Used when a product is discontinued
// or won't be restocked.
//
// Accepts both form POST (redirect) and fetch (JSON) requests.
// JSON callers receive the removed subscriber list so the client can undo.

import type { APIRoute } from "astro";
import { ADMIN_COOKIE_NAME, isAuthenticated } from "@/lib/admin/auth";
import { removeAllSubscriptionsForProduct } from "@/lib/backInStock";


export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isAuthenticated(request, cookies.get(ADMIN_COOKIE_NAME)?.value)) {
    const isJson = request.headers.get("accept")?.includes("application/json");
    if (isJson) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    return redirect("/admin/login?from=/admin/notifications/back-in-stock");
  }

  const isJson = request.headers.get("accept")?.includes("application/json");

  let productId: string;
  try {
    const body = await request.formData();
    productId = (body.get("productId") as string)?.trim();
  } catch {
    return new Response("Invalid form data", { status: 400 });
  }

  if (!productId) return new Response("Missing productId", { status: 400 });

  const removed = await removeAllSubscriptionsForProduct(productId);

  if (isJson) {
    return new Response(JSON.stringify({ removed }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return redirect(`/admin/notifications/back-in-stock?removed=${removed.length}`);
};
