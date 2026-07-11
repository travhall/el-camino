// src/pages/api/admin/banner.ts
// Auth-gated endpoint for saving the announcement banner.

import type { APIRoute } from "astro";
import { isAdminAuthenticated, parseAdminFormData } from "@/lib/admin/auth";
import { saveAnnouncementBanner, type AnnouncementBanner } from "@/lib/announcementBanner";

const REDIRECT_BASE = "/admin/notifications/banner";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isAdminAuthenticated(request, cookies)) {
    return redirect(`/admin/login?from=${REDIRECT_BASE}`);
  }

  const body = await parseAdminFormData(request);
  if (!body) return new Response("Invalid form data", { status: 400 });

  const text = ((body.get("text") as string) ?? "").trim();
  const active = body.get("active") === "on";
  const expiresRaw = ((body.get("expiresAt") as string) ?? "").trim();
  const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(expiresRaw) ? expiresRaw : null;

  const banner: AnnouncementBanner = { text, active, expiresAt };
  await saveAnnouncementBanner(banner);

  return redirect(`${REDIRECT_BASE}?saved=1`);
};
