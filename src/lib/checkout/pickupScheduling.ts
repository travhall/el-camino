import { getShopHoursRaw } from '@/lib/shopHours';
import type { ShopHoursEntry } from '@/lib/shopHours';

// Store timezone for business hours calculations
const STORE_TIMEZONE = 'America/Chicago';

/**
 * Return open/close hours (as 0–23 integers) for a JS day-of-week (0=Sun…6=Sat)
 * from the live admin-managed hours, or null if the store is closed that day.
 * DAYS_OF_WEEK in shopHours is Mon(0)…Sun(6), so we convert with (jsDay + 6) % 7.
 */
function storeHoursForDay(
  jsDay: number,
  hoursData: ShopHoursEntry[]
): { open: number; close: number } | null {
  const idx = (jsDay + 6) % 7;
  const entry = hoursData[idx];
  if (!entry?.isOpen || !entry.open || !entry.close) return null;
  const [oh, om] = entry.open.split(':').map(Number);
  const [ch, cm] = entry.close.split(':').map(Number);
  // Convert to fractional hours for simple comparison
  return { open: oh + om / 60, close: ch + cm / 60 };
}

/**
 * Return the day-of-week and hour-of-day for a UTC Date in the store timezone.
 */
export function storeTimeOf(date: Date): { jsDay: number; hour: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: STORE_TIMEZONE,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hr = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const mn = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  // Fractional hour (e.g. 6:30 PM -> 18.5) to match storeHoursForDay's format
  return { jsDay: dayMap[wd] ?? 0, hour: hr + mn / 60 };
}

/**
 * Round a Date up to the next 15-minute boundary.
 * e.g. 2:07 PM → 2:15 PM, 2:00 PM → 2:00 PM (already on boundary)
 */
function roundUpTo15(date: Date): Date {
  const ms = date.getTime();
  const interval = 15 * 60 * 1000;
  const remainder = ms % interval;
  return remainder === 0 ? new Date(ms) : new Date(ms + (interval - remainder));
}

/**
 * Return the earliest time that is:
 *   (a) at least 2 hours from `from`, rounded up to the next 15-minute mark, AND
 *   (b) during store business hours (from the live admin-managed schedule).
 *
 * When ordering during store hours, the window starts from the order time.
 * When ordering after close (or before open), the 2-hour window starts from
 * the next time the store opens — so open+2h rather than open.
 */
export async function nextPickupTime(from: Date): Promise<Date> {
  const hoursData = await getShopHoursRaw();
  const initialCandidate = roundUpTo15(
    new Date(from.getTime() + 2 * 60 * 60 * 1000)
  );

  // Fast path: order+2h already falls within business hours
  const { jsDay: iDay, hour: iHour } = storeTimeOf(initialCandidate);
  const iHours = storeHoursForDay(iDay, hoursData);
  if (iHours && iHour >= iHours.open && iHour < iHours.close) {
    return initialCandidate;
  }

  // After-hours path: find the next time the store opens, then give a full
  // 2-hour window from that open time (e.g. opens 11 AM → ready at 1 PM).
  let candidate = initialCandidate;
  for (let i = 0; i < 7 * 24 * 4; i++) {
    const { jsDay, hour } = storeTimeOf(candidate);
    const hours = storeHoursForDay(jsDay, hoursData);
    if (hours && hour >= hours.open && hour < hours.close) {
      const pickupCandidate = roundUpTo15(
        new Date(candidate.getTime() + 2 * 60 * 60 * 1000)
      );
      // The +2h window can itself cross closing time on a short operating
      // day (or past midnight) — only return it if it's still within hours.
      const { jsDay: pickupDay, hour: pickupHour } =
        storeTimeOf(pickupCandidate);
      const pickupHours = storeHoursForDay(pickupDay, hoursData);
      if (
        pickupHours &&
        pickupHour >= pickupHours.open &&
        pickupHour < pickupHours.close
      ) {
        return pickupCandidate;
      }
      // Pickup window would exceed close — keep searching for the next slot.
    }
    candidate = new Date(candidate.getTime() + 15 * 60 * 1000);
  }

  return candidate; // fallback — should never reach here
}
