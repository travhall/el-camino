// src/pages/api/admin/contact.ts
// Auth-gated endpoint for saving contact info.

import type { APIRoute } from "astro";
import { isAdminAuthenticated, parseAdminFormData } from "@/lib/admin/auth";
import { saveContactInfo, type ContactInfo } from "@/lib/contactInfo";

const REDIRECT_BASE = "/admin/settings/contact";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isAdminAuthenticated(request, cookies)) {
    return redirect(`/admin/login?from=${REDIRECT_BASE}`);
  }

  const body = await parseAdminFormData(request);
  if (!body) return new Response("Invalid form data", { status: 400 });

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
