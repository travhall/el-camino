// Test endpoint to see raw Square API response structure
// Deploy to Netlify and visit: https://elcaminoskateshop.netlify.app/api/test-sale-data

import type { APIRoute } from "astro";
import { squareClient } from "@/lib/square/client";

// Convert BigInt to string for JSON serialization
function bigIntReplacer(key: string, value: any) {
  return typeof value === 'bigint' ? value.toString() : value;
}

export const GET: APIRoute = async () => {
  try {
    // Fetch first 3 items to find one with sale price
    const { result } = await squareClient.catalogApi.listCatalog(undefined, 'ITEM');
    
    if (!result.objects || result.objects.length === 0) {
      return new Response(JSON.stringify({ error: "No items found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Get first 3 items
    const items = result.objects.slice(0, 3);
    const itemsData = items.map(item => {
      const variations = item.itemData?.variations || [];
      const firstVariation = variations[0];
      
      return {
        productName: item.itemData?.name,
        productId: item.id,
        firstVariation: {
          id: firstVariation?.id,
          name: firstVariation?.itemVariationData?.name,
          priceMoney: firstVariation?.itemVariationData?.priceMoney,
          customAttributeValues: firstVariation?.customAttributeValues,
          // Show ALL field names in itemVariationData
          allFieldNames: firstVariation?.itemVariationData ? Object.keys(firstVariation.itemVariationData) : []
        }
      };
    });

    return new Response(JSON.stringify({
      message: "First 3 products from Square API",
      items: itemsData
    }, bigIntReplacer, 2), {
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
