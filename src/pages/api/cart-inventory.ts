// src/pages/api/cart-inventory.ts
import type { APIRoute } from "astro";
import { checkBulkInventory } from "@/lib/square/inventory";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { variationIds } = (await request.json()) as {
      variationIds: string[];
    };

    if (!variationIds || !Array.isArray(variationIds)) {
      return new Response(
        JSON.stringify({ error: "Invalid variationIds array required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Use existing server-side inventory checking (no CORS issues)
    const inventoryData = await checkBulkInventory(variationIds);

    return new Response(
      JSON.stringify({
        success: true,
        inventory: inventoryData,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // console.error('Cart inventory API error:', error);

    return new Response(
      JSON.stringify({
        error: "Failed to fetch inventory data",
        success: false,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
