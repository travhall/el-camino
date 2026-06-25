// src/lib/shopVisibility.ts
// Stores and retrieves the Shop page visibility toggle using Netlify Blobs.
// Defaults to true (visible) so the Shop nav link shows until Tyler hides it.

import { getStore } from "@netlify/blobs";

const BLOB_KEY = "shop-page-visible";

function store() {
  return getStore({ name: "shop-config", consistency: "strong" });
}

export async function getShopPageVisible(): Promise<boolean> {
  try {
    const value = (await store().get(BLOB_KEY, { type: "json" })) as boolean | null;
    if (typeof value === "boolean") return value;
  } catch {}
  return true;
}

export async function setShopPageVisible(visible: boolean): Promise<void> {
  await store().setJSON(BLOB_KEY, visible);
}
