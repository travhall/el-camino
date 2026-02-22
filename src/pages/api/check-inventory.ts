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

    return new Response(
      JSON.stringify({
        success: true,
        variationId,
        quantity,
        inStock: quantity > 0,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Log full error server-side only — never expose stack traces to clients
    console.error("[API] Error checking inventory:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to check inventory",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
