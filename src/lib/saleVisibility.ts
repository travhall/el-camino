// src/lib/saleVisibility.ts
// Sale page visibility toggle — thin wrapper around the shared pageVisibility module.

import { getPageVisible, setPageVisible } from "@/lib/pageVisibility";

const BLOB_KEY = "sale-page-visible";

export const getSalePageVisible = () => getPageVisible(BLOB_KEY);
export const setSalePageVisible = (visible: boolean) => setPageVisible(BLOB_KEY, visible);
