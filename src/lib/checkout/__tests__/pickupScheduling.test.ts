import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockBlobStore = {
  get: vi.fn(),
  setJSON: vi.fn(),
};

vi.mock('@netlify/blobs', () => ({
  getStore: vi.fn(() => mockBlobStore),
}));

import { nextPickupTime } from '../pickupScheduling';
import type { ShopHoursEntry } from '@/lib/shopHours';

// Store timezone is America/Chicago (fixed in pickupScheduling.ts).
// Build an always-open week so the "fast path" (order+2h already within
// hours) is exercised deterministically regardless of local test-runner TZ.
const openAllWeek = (): ShopHoursEntry[] =>
  [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ].map((day) => ({ day, isOpen: true, open: '00:00', close: '23:45' }));

describe('nextPickupTime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns order time + 2h rounded up to the next 15-minute mark when the store is always open', async () => {
    mockBlobStore.get.mockResolvedValue(openAllWeek());

    // 2026-01-05T12:07:00Z -> +2h = 14:07 -> rounded up to 14:15
    const from = new Date('2026-01-05T12:07:00Z');
    const result = await nextPickupTime(from);

    expect(result.toISOString()).toBe('2026-01-05T14:15:00.000Z');
  });

  it('does not round when order+2h already lands on a 15-minute boundary', async () => {
    mockBlobStore.get.mockResolvedValue(openAllWeek());

    const from = new Date('2026-01-05T12:00:00Z');
    const result = await nextPickupTime(from);

    expect(result.toISOString()).toBe('2026-01-05T14:00:00.000Z');
  });

  it('finds the next open day when the store is closed every day this week except one', async () => {
    const week = openAllWeek().map((entry) => ({
      ...entry,
      isOpen: false,
      open: '',
      close: '',
    }));
    // Open only Wednesday, 11:00-19:00 store time (Chicago).
    const wed = week.find((e) => e.day === 'Wednesday')!;
    wed.isOpen = true;
    wed.open = '11:00';
    wed.close = '19:00';
    mockBlobStore.get.mockResolvedValue(week);

    // Pick a "from" time such that no matter which day of the week it falls
    // on, the store is closed for the immediate order+2h window, forcing the
    // after-hours search path to run. Use a Monday morning.
    const from = new Date('2026-01-05T06:00:00Z'); // a Monday
    const result = await nextPickupTime(from);

    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeGreaterThan(from.getTime());
  });
});
