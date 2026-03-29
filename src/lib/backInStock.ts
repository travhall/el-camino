// src/lib/backInStock.ts
// Stores and retrieves back-in-stock email subscriptions using Netlify Blobs.
// Each subscription is keyed by `{productId}/{email}` so we can efficiently
// list all subscribers for a given product and delete individual entries
// after notifications are sent.

import { getStore } from "@netlify/blobs";

export interface BisSubscription {
  email: string;
  productId: string;
  productTitle: string;
  variationId: string;
  productUrl: string;
  submittedAt: string;
}

function store() {
  return getStore({ name: "back-in-stock-subscriptions", consistency: "strong" });
}

function key(productId: string, email: string) {
  return `${productId}/${email.toLowerCase().trim()}`;
}

export async function addSubscription(sub: BisSubscription): Promise<void> {
  await store().setJSON(key(sub.productId, sub.email), sub);
}

export async function isAlreadySubscribed(
  productId: string,
  email: string
): Promise<boolean> {
  const existing = await store().get(key(productId, email));
  return existing !== null;
}

export async function getSubscriptionsForProduct(
  productId: string
): Promise<BisSubscription[]> {
  const { blobs } = await store().list({ prefix: `${productId}/` });
  const results = await Promise.all(
    blobs.map((b) =>
      store().get(b.key, { type: "json" }) as Promise<BisSubscription | null>
    )
  );
  return results.filter((s): s is BisSubscription => s !== null);
}

export async function removeSubscription(
  productId: string,
  email: string
): Promise<void> {
  await store().delete(key(productId, email));
}

export interface ProductSummary {
  productId: string;
  productTitle: string;
  productUrl: string;
  count: number;
}

export async function getAllProductSummaries(): Promise<ProductSummary[]> {
  const { blobs } = await store().list();
  const map = new Map<string, ProductSummary>();

  await Promise.all(
    blobs.map(async (b) => {
      const sub = (await store().get(b.key, {
        type: "json",
      })) as BisSubscription | null;
      if (!sub) return;
      if (!map.has(sub.productId)) {
        map.set(sub.productId, {
          productId: sub.productId,
          productTitle: sub.productTitle,
          productUrl: sub.productUrl,
          count: 0,
        });
      }
      map.get(sub.productId)!.count++;
    })
  );

  return [...map.values()].sort((a, b) => b.count - a.count);
}
