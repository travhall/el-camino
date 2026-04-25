// src/pages/api/back-in-stock.ts
// Accepts back-in-stock notification requests and stores them in Netlify Blobs.
// Tyler triggers the actual notification emails from the admin panel when
// the product is restocked.

import type { APIRoute } from "astro";
import { addSubscription, isAlreadySubscribed, getSubscriptionsForProduct } from "@/lib/backInStock";
import { sendBisAdminNotification } from "@/lib/email/sender";
import { createRateLimiter, clientIp } from "@/lib/rateLimit";

// 5 submissions per minute per IP — high enough that real users typing
// captchas slowly aren't blocked, low enough to stop a script.
const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });

export const POST: APIRoute = async ({ request }) => {
  if (limiter.check(clientIp(request))) {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again in a minute." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const formData = await request.formData();

    const email = formData.get("email")?.toString().trim() ?? "";
    const productTitle = formData.get("product_title")?.toString().trim() ?? "";
    const productId = formData.get("product_id")?.toString().trim() ?? "";
    const variationId = formData.get("variation_id")?.toString().trim() ?? "";
    const productUrl = formData.get("product_url")?.toString().trim() ?? "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!productId) {
      return new Response(JSON.stringify({ error: "Missing product ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Silently succeed if already subscribed — avoids leaking whether an
    // email is on the list while still giving the customer a success message.
    const alreadyOn = await isAlreadySubscribed(productId, email);
    if (!alreadyOn) {
      await addSubscription({
        email,
        productId,
        productTitle,
        variationId,
        productUrl,
        submittedAt: new Date().toISOString(),
      });
    }

    // Notify Tyler of new subscription (non-blocking)
    if (!alreadyOn) {
      const allSubs = await getSubscriptionsForProduct(productId);
      const origin = new URL(request.url).origin;
      sendBisAdminNotification({
        subscriberEmail: email,
        productName: productTitle,
        totalSubscribers: allSubs.length,
        origin,
      }).catch((err) => console.error("[back-in-stock] Admin notify failed:", err));
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[back-in-stock] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
