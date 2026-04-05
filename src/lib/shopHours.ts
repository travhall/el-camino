// src/lib/shopHours.ts
// Stores and retrieves the regular weekly business hours using Netlify Blobs.
// Falls back to siteConfig.hours so the site works before any admin edits.

import { getStore } from "@netlify/blobs";
import { siteConfig } from "@/lib/site-config";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Internal storage format — times as "HH:MM" (24h). */
export interface ShopHoursEntry {
  day: string;
  isOpen: boolean;
  open: string;  // "HH:MM" 24h, empty when closed
  close: string; // "HH:MM" 24h, empty when closed
}

/** Public display format — matches siteConfig.hours shape so the badge and
 *  hours tables work without changes to their existing reading logic. */
export interface HoursDisplayEntry {
  day: string;
  isOpen: boolean;
  hours: string; // "11am - 7pm" or "Closed"
}

// ── Ordered day list ───────────────────────────────────────────────────────────

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

// ── Blob store ─────────────────────────────────────────────────────────────────

function store() {
  return getStore({ name: "shop-config", consistency: "strong" });
}

// ── Format helpers ─────────────────────────────────────────────────────────────

/** "11:00" → "11am" | "19:00" → "7pm" | "13:30" → "1:30pm" */
export function formatTime(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return m > 0
    ? `${hour}:${String(m).padStart(2, "0")}${period}`
    : `${hour}${period}`;
}

/** ("11:00", "19:00") → "11am - 7pm" */
export function toDisplayHours(open: string, close: string): string {
  if (!open || !close) return "Closed";
  return `${formatTime(open)} - ${formatTime(close)}`;
}

/** "11am" / "7pm" → "HH:MM" 24h */
function to24h(h: number, min: number, period: string): string {
  let hrs = h % 12;
  if (period.toLowerCase() === "pm") hrs += 12;
  return `${String(hrs).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Parse "11am - 7pm" → { open: "11:00", close: "19:00" } */
function parseHoursString(
  hoursStr: string,
): { open: string; close: string } | null {
  const match = hoursStr.match(
    /(\d+)(?::(\d+))?(am|pm)\s*-\s*(\d+)(?::(\d+))?(am|pm)/i,
  );
  if (!match) return null;
  return {
    open: to24h(parseInt(match[1]), parseInt(match[2] ?? "0"), match[3]),
    close: to24h(parseInt(match[4]), parseInt(match[5] ?? "0"), match[6]),
  };
}

// ── Seed from siteConfig ───────────────────────────────────────────────────────

function seedFromSiteConfig(): ShopHoursEntry[] {
  return DAYS_OF_WEEK.map((day) => {
    const entry = siteConfig.hours.find((h) => h.day === day);
    if (!entry?.isOpen) return { day, isOpen: false, open: "", close: "" };
    const parsed = parseHoursString(entry.hours);
    if (!parsed) return { day, isOpen: false, open: "", close: "" };
    return { day, isOpen: true, ...parsed };
  });
}

// ── Blob CRUD ──────────────────────────────────────────────────────────────────

/** Returns the stored weekly schedule in internal format (admin use). */
export async function getShopHoursRaw(): Promise<ShopHoursEntry[]> {
  try {
    const data = (await store().get("shop-hours", {
      type: "json",
    })) as ShopHoursEntry[] | null;
    if (data && Array.isArray(data) && data.length === 7) return data;
  } catch {}
  return seedFromSiteConfig();
}

/** Returns the weekly schedule in display format (badge + hours tables). */
export async function getShopHours(): Promise<HoursDisplayEntry[]> {
  const raw = await getShopHoursRaw();
  return raw.map((entry) => ({
    day: entry.day,
    isOpen: entry.isOpen,
    hours: entry.isOpen
      ? toDisplayHours(entry.open, entry.close)
      : "Closed",
  }));
}

export async function saveShopHours(entries: ShopHoursEntry[]): Promise<void> {
  await store().setJSON("shop-hours", entries);
}
