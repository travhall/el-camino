// src/pages/api/shop-status.ts
// Public endpoint — returns the shop status override config. No auth
// required; no sensitive data exposed.
//
// No longer used by OpenStatusBadge (see plans/189-inline-shop-status-override.md
// — that data is now inlined server-side via Footer.astro's shop-status-data
// script tag). Kept because src/pages/the-shop/index.astro's
// hours-override-notice script still fetches this endpoint independently.

import type { APIRoute } from 'astro';
import { getShopStatusConfig } from '@/lib/shopStatus';

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
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch {
    // Fail open — badge falls back to schedule logic
    return new Response(
      JSON.stringify({ mode: 'auto', until: null, holidays: [] }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
};
