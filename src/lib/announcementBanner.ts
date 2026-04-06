// src/lib/announcementBanner.ts
// Netlify Blobs-backed site-wide announcement banner.

import { getStore } from "@netlify/blobs";

export interface AnnouncementBanner {
  text: string;
  active: boolean;
  expiresAt: string | null; // "YYYY-MM-DD" or null for indefinite
}

const STORE = "shop-config";
const KEY = "announcement-banner";

const DEFAULT: AnnouncementBanner = { text: "", active: false, expiresAt: null };

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
