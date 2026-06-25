// src/lib/pageVisibility.ts
// Generic getter/setter for a boolean page-visibility toggle stored in
// Netlify Blobs. Defaults to true (visible) until explicitly hidden.

import { getStore } from "@netlify/blobs";

function store() {
  return getStore({ name: "shop-config", consistency: "strong" });
}

export async function getPageVisible(blobKey: string): Promise<boolean> {
  try {
    const value = (await store().get(blobKey, { type: "json" })) as boolean | null;
    if (typeof value === "boolean") return value;
  } catch {}
  return true;
}

export async function setPageVisible(blobKey: string, visible: boolean): Promise<void> {
  await store().setJSON(blobKey, visible);
}
