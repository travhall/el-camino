// src/lib/admin/dismissedOrders.ts
//
// Tracks orders that have been manually dismissed from the admin pending lists.
// Used to hide old test/sandbox orders or any order that can't be processed
// normally through Square (e.g. orders with bad email addresses, locked orders).
//
// Dismissed orders are stored per-ID in Netlify Blobs with a 90-day TTL.
// This does not modify Square — it only affects the admin UI.

import { BlobCache } from "@/lib/cache/blobCache";

const NINETY_DAYS = 60 * 60 * 24 * 90;

const store = new BlobCache<true>(
  "admin-dismissed-orders",
  NINETY_DAYS,
  "dismissed"
);

export async function dismissOrder(orderId: string): Promise<void> {
  await store.set(orderId, true);
}

/** Returns a copy of `orders` with any dismissed entries removed. */
export async function filterDismissed<T extends { orderId: string }>(
  orders: T[]
): Promise<T[]> {
  if (orders.length === 0) return [];
  const checks = await Promise.all(
    orders.map((o) =>
      store.get(o.orderId).then((v) => ({ order: o, keep: v !== true }))
    )
  );
  return checks.filter((c) => c.keep).map((c) => c.order);
}
