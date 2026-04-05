// src/pages/api/admin/hours.ts
// Admin-only endpoint for saving the weekly business hours schedule.

import type { APIRoute } from "astro";
import { createHmac } from "node:crypto";
import type { ShopHoursEntry } from "@/lib/shopHours";
import { DAYS_OF_WEEK, saveShopHours } from "@/lib/shopHours";

const COOKIE_NAME = "admin_session";
const REDIRECT_BASE = "/admin/settings/hours";

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

  const entries: ShopHoursEntry[] = DAYS_OF_WEEK.map((day) => {
    const isOpen = body.get(`isOpen_${day}`) === "on";
    const open = isOpen ? ((body.get(`open_${day}`) as string) ?? "").trim() : "";
    const close = isOpen ? ((body.get(`close_${day}`) as string) ?? "").trim() : "";

    // Validate time format if open
    const timeRx = /^\d{2}:\d{2}$/;
    const validOpen = timeRx.test(open);
    const validClose = timeRx.test(close);

    return {
      day,
      isOpen: isOpen && validOpen && validClose,
      open: validOpen ? open : "",
      close: validClose ? close : "",
    };
  });

  await saveShopHours(entries);
  return redirect(`${REDIRECT_BASE}?saved=1`);
};
