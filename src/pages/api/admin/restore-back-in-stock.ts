// src/pages/api/admin/restore-back-in-stock.ts
// Re-adds a set of back-in-stock subscriptions that were previously removed.
// Called by the client-side undo toast when an admin changes their mind.

import type { APIRoute } from "astro";
import { ADMIN_COOKIE_NAME, isAuthenticated } from "@/lib/admin/auth";
import { addSubscription, type BisSubscription } from "@/lib/backInStock";


export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(request, cookies.get(ADMIN_COOKIE_NAME)?.value)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let subscriptions: BisSubscription[];
  try {
    const body = await request.json();
    subscriptions = body.subscriptions;
    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return new Response(JSON.stringify({ error: "No subscriptions provided" }), { status: 400 });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  await Promise.all(subscriptions.map((sub) => addSubscription(sub)));

  return new Response(JSON.stringify({ restored: subscriptions.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
