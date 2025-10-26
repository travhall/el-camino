// src/pages/api/check-inventory.ts
import type { APIRoute } from "astro";
import { squareClient } from "../../lib/square/client";

export const GET: APIRoute = async ({ request, url }) => {
  try {
    // Get variation ID from query parameter
    const variationId = url.searchParams.get("variationId");

    if (!variationId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing variationId parameter",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check inventory directly from Square API
    const { result } = await squareClient.inventoryApi.retrieveInventoryCount(
      variationId
    );

    // Get the counts and find IN_STOCK state
    const counts = result.counts || [];

    // Find in-stock quantity
    const inStockCount = counts.find((count) => count.state === "IN_STOCK");

    // Parse quantity as number (Square returns string)
    const quantity = inStockCount?.quantity
      ? parseInt(inStockCount.quantity, 10)
      : 0;

    // Return the inventory data with full details for debugging
    return new Response(
      JSON.stringify({
        success: true,
        variationId,
        quantity,
        inStock: quantity > 0,
        rawCounts: counts,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // console.error("[API] Error checking inventory:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to check inventory";

    const errorDetails =
      error instanceof Error ? { name: error.name, stack: error.stack } : {};

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
