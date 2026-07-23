// src/pages/api/admin/social.ts
// Auth-gated endpoint for managing social links (add / remove / reorder).

import type { APIRoute } from "astro";
import { isAdminAuthenticated, parseAdminFormData } from "@/lib/admin/auth";
import { getSocialLinks, saveSocialLinks, KNOWN_PLATFORMS, type SocialLink } from "@/lib/socialLinks";

const REDIRECT_BASE = "/admin/settings/social";
const ALLOWED_URL_SCHEMES = ["https:", "http:"];

function hasAllowedScheme(url: string): boolean {
  try {
    return ALLOWED_URL_SCHEMES.includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isAdminAuthenticated(request, cookies)) {
    return redirect(`/admin/login?from=${REDIRECT_BASE}`);
  }

  const body = await parseAdminFormData(request);
  if (!body) return new Response("Invalid form data", { status: 400 });

  const action = body.get("action") as string;
  const links = await getSocialLinks();

  if (action === "add") {
    const platform = ((body.get("platform") as string) ?? "").trim().toLowerCase();
    const url = ((body.get("url") as string) ?? "").trim();
    const icon = KNOWN_PLATFORMS[platform] ?? `uil:${platform}`;

    if (!platform || !url) {
      return redirect(`${REDIRECT_BASE}?error=missing-fields`);
    }

    if (!hasAllowedScheme(url)) {
      return redirect(`${REDIRECT_BASE}?error=invalid-url`);
    }

    // Don't allow duplicate platforms
    if (links.some((l) => l.platform === platform)) {
      return redirect(`${REDIRECT_BASE}?error=duplicate`);
    }

    const newLink: SocialLink = { platform, url, icon };
    await saveSocialLinks([...links, newLink]);

  } else if (action === "remove") {
    const platform = ((body.get("platform") as string) ?? "").trim();
    await saveSocialLinks(links.filter((l) => l.platform !== platform));

  } else if (action === "update-url") {
    const platform = ((body.get("platform") as string) ?? "").trim();
    const url = ((body.get("url") as string) ?? "").trim();

    if (!hasAllowedScheme(url)) {
      return redirect(`${REDIRECT_BASE}?error=invalid-url`);
    }

    const updated = links.map((l) =>
      l.platform === platform ? { ...l, url } : l,
    );
    await saveSocialLinks(updated);

  } else {
    return new Response("Unknown action", { status: 400 });
  }

  return redirect(`${REDIRECT_BASE}?saved=1`);
};
