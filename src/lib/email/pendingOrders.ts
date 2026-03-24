// src/lib/email/pendingOrders.ts
import { BlobCache } from "@/lib/cache/blobCache";

export interface PendingOrderContact {
  email: string;
  name: string;
  fulfillmentMethod: "shipping" | "pickup";
}

// TTL: 2 hours — long enough to survive slow Square webhook delivery
const TWO_HOURS = 60 * 60 * 2;
// Distinct storeName keeps pending order blobs out of the "square-cache" store
const pendingOrderStore = new BlobCache<PendingOrderContact>(
  "pending-order-emails",
  TWO_HOURS,
  "email-pending"
);

export async function storePendingOrder(
  orderId: string,
  contact: PendingOrderContact
): Promise<void> {
  await pendingOrderStore.set(orderId, contact);
}

export async function getPendingOrder(
  orderId: string
): Promise<PendingOrderContact | null> {
  return (await pendingOrderStore.get(orderId)) ?? null;
}

export async function deletePendingOrder(orderId: string): Promise<void> {
  await pendingOrderStore.delete(orderId);
}
