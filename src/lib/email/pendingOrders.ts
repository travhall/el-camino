// src/lib/email/pendingOrders.ts
import { getStore } from '@netlify/blobs';
import { BlobCache } from '@/lib/cache/blobCache';

export interface PendingOrderContact {
  email: string;
  name: string;
  fulfillmentMethod: 'shipping' | 'pickup';
}

// TTL: 2 hours — long enough to survive slow Square webhook delivery
const TWO_HOURS = 60 * 60 * 2;
// Distinct storeName keeps pending order blobs out of the "square-cache" store
const pendingOrderStore = new BlobCache<PendingOrderContact>(
  'pending-order-emails',
  TWO_HOURS,
  'email-pending'
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

// ── Email claims ─────────────────────────────────────────────────────────────
//
// Square retries a webhook delivery it thinks failed, and can deliver
// payment.updated more than once, so two deliveries for one order can run at
// the same time. Reading the pending record is not enough to tell them apart:
// both read it before either deletes it. A claim is the atomic step: the write
// only succeeds if the key does not exist yet, so exactly one delivery wins.
//
// A claim ends one of three ways:
//   completed  emails went out. The claim stays (until the blob store is
//              cleaned) so a late retry sends nothing, even if deleting the
//              pending record failed.
//   released   sending failed. The next delivery may try again.
//   abandoned  the function died mid-send. After CLAIM_STALE_MS another
//              delivery may take it over, so one crash can't block the email
//              for good.

interface EmailClaim {
  at: number;
  done: boolean;
}

const CLAIM_STORE = 'email-pending';
const CLAIM_STALE_MS = 2 * 60 * 1000;
const claimKey = (orderId: string) => `email-claim:${orderId}`;

// Used when Netlify Blobs isn't available (local dev). One process, so a Map
// is atomic enough.
const localClaims = new Map<string, EmailClaim>();

function claimStore() {
  const isDevelopment =
    process.env.NODE_ENV === 'development' ||
    process.env.ASTRO_NODE_ENV === 'development';
  if (isDevelopment) return null;
  try {
    return getStore(CLAIM_STORE);
  } catch {
    return null;
  }
}

function claimableAgain(claim: EmailClaim | null, now: number): boolean {
  return !claim || (!claim.done && now - claim.at > CLAIM_STALE_MS);
}

/**
 * Take the right to send this order's emails. Returns false when another
 * delivery already holds it or has already sent them.
 *
 * If the blob store itself errors, this returns true: a possible duplicate
 * email is the lesser harm next to a customer who gets no confirmation.
 */
export async function claimOrderEmail(orderId: string): Promise<boolean> {
  const key = claimKey(orderId);
  const now = Date.now();
  const store = claimStore();

  if (!store) {
    if (!claimableAgain(localClaims.get(key) ?? null, now)) return false;
    localClaims.set(key, { at: now, done: false });
    return true;
  }

  try {
    const fresh: EmailClaim = { at: now, done: false };
    const first = await store.setJSON(key, fresh, { onlyIfNew: true });
    if (first.modified) return true;

    const existing = await store.getWithMetadata(key, {
      type: 'json',
      consistency: 'strong',
    });
    if (!existing) {
      // Released between the two calls: race for it again from scratch.
      const again = await store.setJSON(key, fresh, { onlyIfNew: true });
      return again.modified;
    }
    if (!claimableAgain(existing.data as EmailClaim, now)) return false;
    if (!existing.etag) return false;

    // Abandoned. Replace it only if it is still the exact claim just read, so
    // two deliveries taking over at once can't both succeed.
    const takeover = await store.setJSON(key, fresh, {
      onlyIfMatch: existing.etag,
    });
    return takeover.modified;
  } catch (error) {
    console.warn(
      `[PendingOrders] Claim check failed for ${orderId}; sending anyway:`,
      error
    );
    return true;
  }
}

/** Mark the claim as "emails sent" so no later delivery sends them again. */
export async function completeOrderEmailClaim(orderId: string): Promise<void> {
  const key = claimKey(orderId);
  const done: EmailClaim = { at: Date.now(), done: true };
  const store = claimStore();
  if (!store) {
    localClaims.set(key, done);
    return;
  }
  await store.setJSON(key, done);
}

/** Give the claim up after a failed send so a later delivery can retry. */
export async function releaseOrderEmailClaim(orderId: string): Promise<void> {
  const key = claimKey(orderId);
  const store = claimStore();
  if (!store) {
    localClaims.delete(key);
    return;
  }
  await store.delete(key);
}
