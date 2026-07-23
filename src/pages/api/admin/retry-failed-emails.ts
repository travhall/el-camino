// src/pages/api/admin/retry-failed-emails.ts
// Admin endpoint to list and retry failed webhook email deliveries.
import type { APIRoute } from "astro";
import { isAdminAuthenticated, unauthorizedResponse } from "@/lib/admin/auth";
import {
  listFailedEmails,
  getFailedEmail,
  deleteFailedEmail,
} from "@/lib/email/failedEmails";
import { sendOrderConfirmation } from "@/lib/email/sender";

// GET: list all failed email delivery records
export const GET: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthenticated(request, cookies)) {
    return unauthorizedResponse();
  }
  const failed = await listFailedEmails();
  return new Response(JSON.stringify({ success: true, failed }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

// POST: retry a specific failed email by orderId
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthenticated(request, cookies)) {
    return unauthorizedResponse();
  }
  const { orderId } = await request.json();
  if (!orderId) {
    return new Response(JSON.stringify({ error: "Missing orderId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const record = await getFailedEmail(orderId);
  if (!record) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await sendOrderConfirmation({ order: record.order, contact: record.contact });
    await deleteFailedEmail(orderId);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
