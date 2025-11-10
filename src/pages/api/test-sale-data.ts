// Test endpoint to see raw Square API response structure
// Deploy to Netlify and visit: https://elcaminoskateshop.netlify.app/api/test-sale-data

import type { APIRoute } from "astro";
import { squareClient } from "@/lib/square/client";

export const GET: APIRoute = async () => {
  try {
    // Fetch a specific product that has a sale price set
    const productId = "I6W6T2FYB57NQTQEDBJSCXWV"; // Anti-Hero Chris Pfanner deck
    
    const { result } = await squareClient.catalogApi.retrieveCatalogObject(
      productId,
      true // include related objects
    );

    if (!result.object) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const item = result.object;
    const variations = item.itemData?.variations || [];
    const firstVariation = variations[0];

    // Return complete structure so we can see where sale price is
    return new Response(JSON.stringify({
      productName: item.itemData?.name,
      productId: item.id,
      firstVariation: {
        id: firstVariation?.id,
        name: firstVariation?.itemVariationData?.name,
        priceMoney: firstVariation?.itemVariationData?.priceMoney,
        customAttributeValues: firstVariation?.customAttributeValues,
        // Show ALL fields in itemVariationData
        allFields: firstVariation?.itemVariationData ? Object.keys(firstVariation.itemVariationData) : []
      },
      // Raw first variation for inspection
      rawFirstVariation: firstVariation
    }, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
