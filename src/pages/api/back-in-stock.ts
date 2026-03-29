// src/pages/api/back-in-stock.ts
// Accepts back-in-stock notification requests and stores them in Netlify Blobs.
// Tyler triggers the actual notification emails from the admin panel when
// the product is restocked.

import type { APIRoute } from "astro";
import { addSubscription, isAlreadySubscribed } from "@/lib/backInStock";

export const POST: APIRoute = async ({ request }) => {
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

    console.log(
      `[back-in-stock] ${alreadyOn ? "Already subscribed" : "Subscribed"}: ${email} → ${productTitle}`
    );

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
