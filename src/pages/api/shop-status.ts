// src/pages/api/shop-status.ts
// Public endpoint — returns the shop status override config for client-side
// resolution in OpenStatusBadge. No auth required; no sensitive data exposed.

import type { APIRoute } from "astro";
import { getShopStatusConfig } from "@/lib/shopStatus";

export const GET: APIRoute = async () => {
  try {
    const config = await getShopStatusConfig();
    return new Response(
      JSON.stringify({
        mode: config.mode,
        until: config.until ?? null,
        holidays: config.holidays,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    // Fail open — badge falls back to schedule logic
    return new Response(
      JSON.stringify({ mode: "auto", until: null, holidays: [] }),
      { headers: { "Content-Type": "application/json" } },
    );
  }
};
