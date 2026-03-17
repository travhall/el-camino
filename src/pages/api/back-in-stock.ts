// src/pages/api/back-in-stock.ts
// Accepts back-in-stock notification requests and forwards them via Netlify Forms.
// Netlify will email the form submission to the address configured in the dashboard
// under Forms > Notifications.

import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();

    const email = formData.get("email")?.toString().trim();
    const productTitle = formData.get("product_title")?.toString().trim();
    const productId = formData.get("product_id")?.toString().trim();
    const variationId = formData.get("variation_id")?.toString().trim();

    // Basic validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Forward to Netlify Forms (works automatically in Netlify deployments)
    const netlifyFormData = new URLSearchParams({
      "form-name": "back-in-stock",
      email,
      product_title: productTitle ?? "",
      product_id: productId ?? "",
      variation_id: variationId ?? "",
      submitted_at: new Date().toISOString(),
    });

    const netlifyRes = await fetch(request.headers.get("origin") ?? "/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: netlifyFormData.toString(),
    });

    // Netlify Forms returns 200 or 302 on success
    if (netlifyRes.ok || netlifyRes.status === 302) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // In local dev Netlify Forms isn't active — still return success so UX works
    if (import.meta.env.DEV) {
      console.log("[BackInStock] Dev mode — would submit:", {
        email,
        productTitle,
        productId,
        variationId,
      });
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Form submission failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[BackInStock] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
