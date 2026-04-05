// src/lib/socialLinks.ts
// Netlify Blobs-backed social links with siteConfig fallback.

import { getStore } from "@netlify/blobs";
import { siteConfig } from "@/lib/site-config";

export interface SocialLink {
  platform: string; // e.g. "instagram"
  url: string;
  icon: string;     // astro-icon name, e.g. "uil:instagram"
}

// Common platforms — icon auto-filled when Tyler picks from the list
export const KNOWN_PLATFORMS: Record<string, string> = {
  facebook: "uil:facebook",
  instagram: "uil:instagram",
  tiktok: "uil:tiktok",
  twitter: "uil:twitter",
  youtube: "uil:youtube",
  snapchat: "uil:snapchat",
  linkedin: "uil:linkedin",
};

const STORE = "shop-config";
const KEY = "social-links";

export async function getSocialLinks(): Promise<SocialLink[]> {
  try {
    const store = getStore(STORE);
    const data = await store.get(KEY, { type: "json" });
    if (data) return data as SocialLink[];
  } catch {
    // Blobs unavailable
  }
  return siteConfig.social as SocialLink[];
}

export async function saveSocialLinks(links: SocialLink[]): Promise<void> {
  const store = getStore(STORE);
  await store.setJSON(KEY, links);
}
