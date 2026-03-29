// src/pages/api/admin/restore-back-in-stock.ts
// Re-adds a set of back-in-stock subscriptions that were previously removed.
// Called by the client-side undo toast when an admin changes their mind.

import type { APIRoute } from "astro";
import { createHmac } from "node:crypto";
import { addSubscription, type BisSubscription } from "@/lib/backInStock";

const COOKIE_NAME = "admin_session";

function expectedToken(secret: string): string {
  return createHmac("sha256", secret).update("admin:authenticated").digest("hex");
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return new Response("Admin not configured", { status: 503 });

  const sessionToken = cookies.get(COOKIE_NAME)?.value ?? "";
  if (sessionToken !== expectedToken(secret)) {
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
