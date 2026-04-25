// src/pages/api/admin/contact.ts
// Auth-gated endpoint for saving contact info.

import type { APIRoute } from "astro";
import { ADMIN_COOKIE_NAME, isAuthenticated } from "@/lib/admin/auth";
import { saveContactInfo, type ContactInfo } from "@/lib/contactInfo";

const REDIRECT_BASE = "/admin/settings/contact";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isAuthenticated(request, cookies.get(ADMIN_COOKIE_NAME)?.value)) {
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
