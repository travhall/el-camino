// src/pages/api/admin/banner.ts
// Auth-gated endpoint for saving the announcement banner.

import type { APIRoute } from "astro";
import { createHmac } from "node:crypto";
import { saveAnnouncementBanner, type AnnouncementBanner } from "@/lib/announcementBanner";

const COOKIE_NAME = "admin_session";
const REDIRECT_BASE = "/admin/notifications/banner";

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

  const text = ((body.get("text") as string) ?? "").trim();
  const active = body.get("active") === "on";
  const expiresRaw = ((body.get("expiresAt") as string) ?? "").trim();
  const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(expiresRaw) ? expiresRaw : null;

  const banner: AnnouncementBanner = { text, active, expiresAt };
  await saveAnnouncementBanner(banner);

  return redirect(`${REDIRECT_BASE}?saved=1`);
};
