// Test endpoint to check for locationOverrides and sale pricing
// Visit: https://elcaminoskateshop.netlify.app/api/test-sale-price

import type { APIRoute } from "astro";
import { squareClient } from "@/lib/square/client";

function bigIntReplacer(key: string, value: any) {
  return typeof value === 'bigint' ? value.toString() : value;
}

export const GET: APIRoute = async () => {
  try {
    // Get all locations first
    const locationsResult = await squareClient.locationsApi.listLocations();
    const locations = locationsResult.result.locations?.map(loc => ({
      id: loc.id,
      name: loc.name,
      status: loc.status
    }));

    // Get first 3 items
    const { result } = await squareClient.catalogApi.listCatalog(undefined, 'ITEM');
    
    if (!result.objects || result.objects.length === 0) {
      return new Response(JSON.stringify({ error: "No items found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const items = result.objects.slice(0, 3).map(item => {
      const variations = item.itemData?.variations || [];
      const firstVariation = variations[0];
      
      return {
        productName: item.itemData?.name,
        productId: item.id,
        // Check item-level fields
        itemLevelFields: item.itemData ? Object.keys(item.itemData) : [],
        itemCustomAttributes: item.customAttributeValues,
        firstVariation: {
          id: firstVariation?.id,
          name: firstVariation?.itemVariationData?.name,
          priceMoney: firstVariation?.itemVariationData?.priceMoney,
          locationOverrides: firstVariation?.itemVariationData?.locationOverrides,
          customAttributes: firstVariation?.customAttributeValues,
          // Show ALL fields
          allFields: firstVariation?.itemVariationData ? Object.keys(firstVariation.itemVariationData) : []
        }
      };
    });

    return new Response(JSON.stringify({
      locations,
      items
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
