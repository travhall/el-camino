// src/pages/api/batch-inventory.ts
// Server-side batch inventory check — called by cart/index.ts client-side code.
// Keeping Square credentials server-side only; never import square/client in client bundles.
import type { APIRoute } from "astro";
import { checkBulkInventory } from "@/lib/square/inventory";

const MAX_VARIATION_IDS = 50;

export const GET: APIRoute = async ({ url }) => {
  try {
    const param = url.searchParams.get("variationIds");

    if (!param) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing variationIds parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const variationIds = param
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (variationIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid variation IDs provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (variationIds.length > MAX_VARIATION_IDS) {
      return new Response(
        JSON.stringify({ success: false, error: "Too many variation IDs" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const stockLevels = await checkBulkInventory(variationIds);

    return new Response(
      JSON.stringify({ success: true, stockLevels }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[API] Error checking batch inventory:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to check inventory" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
