// src/pages/api/admin/sale-visibility.ts
// Admin-only endpoint for toggling the Sale page nav link visibility.

import type { APIRoute } from "astro";
import { isAdminAuthenticated, parseAdminFormData } from "@/lib/admin/auth";
import { setSalePageVisible } from "@/lib/saleVisibility";

const REDIRECT_BASE = "/admin/settings/navigation";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isAdminAuthenticated(request, cookies)) {
    return redirect(`/admin/login?from=${REDIRECT_BASE}`);
  }

  const body = await parseAdminFormData(request);
  if (!body) return new Response("Invalid form data", { status: 400 });

  const visible = body.get("salePageVisible") === "on";
  await setSalePageVisible(visible);

  return redirect(`${REDIRECT_BASE}?saved=1`);
};
