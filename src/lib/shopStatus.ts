// src/lib/shopStatus.ts
// Stores and retrieves shop open-status overrides using Netlify Blobs.
// Supports a manual override (force open/closed with optional expiry) and
// a holiday list (specific dates or annually recurring month-day entries).

import { getStore } from "@netlify/blobs";

export interface HolidayEntry {
  id: string;
  label: string;
  date?: string;      // "YYYY-MM-DD" — matches that date only
  recurring?: string; // "MM-DD" — matches that month/day every year
}

export interface ShopStatusConfig {
  mode: "auto" | "open" | "closed";
  until?: string;     // "YYYY-MM-DD" inclusive — override reverts after this date
  holidays: HolidayEntry[];
}

export type ResolvedShopStatus =
  | { source: "override"; status: "open" | "closed" }
  | { source: "holiday"; status: "closed"; label: string }
  | { source: "auto" };

const DEFAULT_CONFIG: ShopStatusConfig = { mode: "auto", holidays: [] };

function store() {
  return getStore({ name: "shop-config", consistency: "strong" });
}

export async function getShopStatusConfig(): Promise<ShopStatusConfig> {
  try {
    const data = (await store().get("shop-status", {
      type: "json",
    })) as ShopStatusConfig | null;
    if (!data) return { ...DEFAULT_CONFIG };
    // Ensure holidays array always exists even on old stored data
    return { holidays: [], ...data };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveShopStatusConfig(
  config: ShopStatusConfig,
): Promise<void> {
  await store().setJSON("shop-status", config);
}

/**
 * Resolves the effective shop status for a given date string in "YYYY-MM-DD"
 * format. Pass the current date in the shop's local timezone (America/Chicago).
 *
 * Priority: manual override > holiday match > auto (follow schedule)
 */
export function resolveShopStatus(
  config: ShopStatusConfig,
  todayStr: string,
): ResolvedShopStatus {
  // Manual override takes priority
  if (config.mode !== "auto") {
    if (!config.until || config.until >= todayStr) {
      return { source: "override", status: config.mode };
    }
    // "until" has expired — fall through to holiday / auto
  }

  // Holiday check
  const monthDay = todayStr.slice(5); // "MM-DD"
  for (const h of config.holidays) {
    if (
      (h.date && h.date === todayStr) ||
      (h.recurring && h.recurring === monthDay)
    ) {
      return { source: "holiday", status: "closed", label: h.label };
    }
  }

  return { source: "auto" };
}

// ── Display helpers ────────────────────────────────────────────────────────────

/** Formats "YYYY-MM-DD" → "April 20, 2026" without timezone shift. */
export function formatFullDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Formats "MM-DD" → "April 20". */
export function formatMonthDay(mmdd: string): string {
  const [month, day] = mmdd.split("-").map(Number);
  return new Date(2000, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}
