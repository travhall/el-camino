// src/pages/api/admin/remove-back-in-stock.ts
// Silently removes all back-in-stock subscribers for a product without
// sending any notification emails. Used when a product is discontinued
// or won't be restocked.
//
// Accepts both form POST (redirect) and fetch (JSON) requests.
// JSON callers receive the removed subscriber list so the client can undo.

import type { APIRoute } from "astro";
import { createHmac } from "node:crypto";
import { removeAllSubscriptionsForProduct } from "@/lib/backInStock";

const COOKIE_NAME = "admin_session";

function expectedToken(secret: string): string {
  return createHmac("sha256", secret).update("admin:authenticated").digest("hex");
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return new Response("Admin not configured", { status: 503 });

  const sessionToken = cookies.get(COOKIE_NAME)?.value ?? "";
  if (sessionToken !== expectedToken(secret)) {
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
