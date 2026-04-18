// src/pages/api/admin/sale-visibility.ts
// Admin-only endpoint for toggling the Sale page nav link visibility.

import type { APIRoute } from "astro";
import { createHmac } from "node:crypto";
import { setSalePageVisible } from "@/lib/saleVisibility";

const COOKIE_NAME = "admin_session";
const REDIRECT_BASE = "/admin/settings/navigation";

function expectedToken(secret: string): string {
  return createHmac("sha256", secret).update("admin:authenticated").digest("hex");
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return new Response("Admin not configured", { status: 503 });

  const sessionToken = cookies.get(COOKIE_NAME)?.value ?? "";
  if (sessionToken !== expectedToken(secret)) {
    return redirect(`/admin/login?from=${REDIRECT_BASE}`);
  }

  let body: FormData;
  try {
    body = await request.formData();
  } catch {
    return new Response("Invalid form data", { status: 400 });
  }

  const visible = body.get("salePageVisible") === "on";
  await setSalePageVisible(visible);

  return redirect(`${REDIRECT_BASE}?saved=1`);
};
