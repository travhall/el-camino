// src/pages/api/hours.ts
// Public endpoint — returns the current weekly hours schedule in display
// format. Consumed by any client that needs live hours data.

import type { APIRoute } from "astro";
import { getShopHours } from "@/lib/shopHours";

export const GET: APIRoute = async () => {
  try {
    const hours = await getShopHours();
    return new Response(JSON.stringify(hours), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response(JSON.stringify([]), {
      headers: { "Content-Type": "application/json" },
    });
  }
};
