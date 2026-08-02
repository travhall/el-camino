// src/lib/announcementBanner.ts
// Netlify Blobs-backed site-wide announcement banner.

import { getStore } from "@netlify/blobs";

export interface AnnouncementBanner {
  text: string;
  active: boolean;
  expiresAt: string | null; // "YYYY-MM-DD" or null for indefinite
  linkUrl?: string; // optional — absolute (https://) or root-relative (/) URL
}

const STORE = "shop-config";
const KEY = "announcement-banner";

const DEFAULT: AnnouncementBanner = { text: "", active: false, expiresAt: null };

/**
 * Validates a banner link URL. Returns the URL if valid, otherwise "".
 * Accepts root-relative paths (/...) and absolute https:// URLs only.
 * Rejects javascript:, data:, and all other schemes to prevent XSS.
 */
export function sanitizeLinkUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return "";
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return url;
  } catch {
    // not a valid URL
  }
  return "";
}

export async function getAnnouncementBanner(): Promise<AnnouncementBanner> {
  try {
    const store = getStore(STORE);
    const data = await store.get(KEY, { type: "json" });
    if (data) return data as AnnouncementBanner;
  } catch {
    // Blobs unavailable
  }
  return DEFAULT;
}

export async function saveAnnouncementBanner(
  banner: AnnouncementBanner,
): Promise<void> {
  const store = getStore(STORE);
  await store.setJSON(KEY, banner);
}

/**
 * Returns the banner text if it should be shown today, otherwise null.
 * todayStr: "YYYY-MM-DD" in the shop's local timezone.
 */
export function resolveAnnouncementBanner(
  banner: AnnouncementBanner,
  todayStr: string,
): string | null {
  if (!banner.active || !banner.text.trim()) return null;
  if (banner.expiresAt && todayStr >= banner.expiresAt) return null;
  return banner.text.trim();
}
