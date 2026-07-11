// src/pages/api/admin/shop-visibility.ts
// Admin-only endpoint for toggling the Shop page nav link visibility.

import type { APIRoute } from "astro";
import { isAdminAuthenticated, parseAdminFormData } from "@/lib/admin/auth";
import { setShopPageVisible } from "@/lib/shopVisibility";

const REDIRECT_BASE = "/admin/settings/navigation";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isAdminAuthenticated(request, cookies)) {
    return redirect(`/admin/login?from=${REDIRECT_BASE}`);
  }

  const body = await parseAdminFormData(request);
  if (!body) return new Response("Invalid form data", { status: 400 });

  const visible = body.get("shopPageVisible") === "on";
  await setShopPageVisible(visible);

  return redirect(`${REDIRECT_BASE}?saved=1`);
};
