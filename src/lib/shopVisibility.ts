// src/lib/shopVisibility.ts
// Shop page visibility toggle — thin wrapper around the shared pageVisibility module.

import { getPageVisible, setPageVisible } from "@/lib/pageVisibility";

const BLOB_KEY = "shop-page-visible";

export const getShopPageVisible = () => getPageVisible(BLOB_KEY);
export const setShopPageVisible = (visible: boolean) => setPageVisible(BLOB_KEY, visible);
