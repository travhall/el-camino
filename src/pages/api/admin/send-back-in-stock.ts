// src/pages/api/admin/send-back-in-stock.ts
// Sends back-in-stock notification emails to all subscribers for a given
// product and removes their entries from the blob store.

import type { APIRoute } from "astro";
import { createHmac } from "node:crypto";
import { getSubscriptionsForProduct, removeSubscription } from "@/lib/backInStock";
import { sendBackInStockNotification } from "@/lib/email/sender";

const COOKIE_NAME = "admin_session";

function expectedToken(secret: string): string {
  return createHmac("sha256", secret).update("admin:authenticated").digest("hex");
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return new Response("Admin not configured", { status: 503 });

  const sessionToken = cookies.get(COOKIE_NAME)?.value ?? "";
  if (sessionToken !== expectedToken(secret)) {
    return redirect("/admin/login?from=/admin/back-in-stock");
  }

  let productId: string;
  try {
    const body = await request.formData();
    productId = (body.get("productId") as string)?.trim();
  } catch {
    return new Response("Invalid form data", { status: 400 });
  }

  if (!productId) return new Response("Missing productId", { status: 400 });

  const subscribers = await getSubscriptionsForProduct(productId);
  if (subscribers.length === 0) {
    return redirect("/admin/back-in-stock?error=none");
  }

  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    try {
      await sendBackInStockNotification({
        email: sub.email,
        productName: sub.productTitle,
        productUrl: sub.productUrl,
        variationId: sub.variationId,
      });
      await removeSubscription(sub.productId, sub.email);
      sent++;
    } catch (err) {
      console.error(`[send-back-in-stock] Failed for ${sub.email}:`, err);
      failed++;
    }
  }

  const params = new URLSearchParams({ sent: String(sent) });
  if (failed > 0) params.set("failed", String(failed));
  return redirect(`/admin/back-in-stock?${params}`);
};
