// TEMPORARY DEBUG ENDPOINT — delete after email testing is complete
// Usage: GET /api/debug/email-check?key=elco-debug&orderId=<id>
// Checks env vars, reads the pending order blob, and sends a test email.

import type { APIRoute } from "astro";
import { getPendingOrder } from "@/lib/email/pendingOrders";
import { Resend } from "resend";

export const GET: APIRoute = async ({ url }) => {
  // Simple guard — not a secret, just prevents accidental public exposure
  if (url.searchParams.get("key") !== "elco-debug") {
    return new Response("Not found", { status: 404 });
  }

  const orderId = url.searchParams.get("orderId");

  const result: Record<string, unknown> = {
    env: {
      RESEND_API_KEY: import.meta.env.RESEND_API_KEY ? "✅ set" : "❌ missing",
      EMAIL_FROM: import.meta.env.EMAIL_FROM
        ? `✅ ${import.meta.env.EMAIL_FROM}`
        : "❌ missing",
      TYLER_EMAIL: import.meta.env.TYLER_EMAIL
        ? `✅ ${import.meta.env.TYLER_EMAIL}`
        : "❌ missing",
      SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN ? "✅ set" : "❌ missing",
    },
    blob: null,
    resend: null,
  };

  // 1. Check blob lookup if orderId provided
  if (orderId) {
    try {
      const contact = await getPendingOrder(orderId);
      result.blob = contact
        ? { found: true, email: contact.email, name: contact.name, fulfillmentMethod: contact.fulfillmentMethod }
        : { found: false };
    } catch (err) {
      result.blob = { error: String(err) };
    }
  }

  // 2. Try sending a test email via Resend
  try {
    const resend = new Resend(import.meta.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: import.meta.env.EMAIL_FROM ?? "onboarding@resend.dev",
      to: import.meta.env.TYLER_EMAIL ?? "test@example.com",
      subject: "El Camino — debug test email",
      html: "<p>Debug test from <strong>email-check</strong> endpoint. If you received this, Resend is configured correctly.</p>",
    });
    result.resend = error
      ? { success: false, error }
      : { success: true, id: data?.id };
  } catch (err) {
    result.resend = { success: false, threw: String(err) };
  }

  return new Response(JSON.stringify(result, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
