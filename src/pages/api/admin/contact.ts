// src/pages/api/admin/contact.ts
// Auth-gated endpoint for saving contact info.

import type { APIRoute } from "astro";
import { createHmac } from "node:crypto";
import { saveContactInfo, type ContactInfo } from "@/lib/contactInfo";

const COOKIE_NAME = "admin_session";
const REDIRECT_BASE = "/admin/settings/contact";

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

  const get = (k: string) => ((body.get(k) as string) ?? "").trim();

  const phone = get("phone");
  const phoneRaw = phone.replace(/\D/g, "");

  const info: ContactInfo = {
    name: get("name"),
    street: get("street"),
    city: get("city"),
    state: get("state"),
    zip: get("zip"),
    phone,
    phoneRaw: phoneRaw ? `+${phoneRaw}` : "",
    email: get("email"),
  };

  await saveContactInfo(info);
  return redirect(`${REDIRECT_BASE}?saved=1`);
};
