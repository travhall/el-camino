// src/pages/api/quick-view-product.ts
import type { APIRoute } from "astro";
import { fetchProduct } from "@/lib/square/client";
import { checkBulkInventory } from "@/lib/square/inventory";
import { processSquareError, logError } from "@/lib/square/errorUtils";

export const GET: APIRoute = async ({ url }) => {
  try {
    const productId = url.searchParams.get("id");

    if (!productId) {
      return new Response(JSON.stringify({ error: "Product ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch product using existing client
    const product = await fetchProduct(productId);

    if (!product) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get inventory for all variations
    let inventoryMap: Record<string, number> = {};

    if (product.variations && product.variations.length > 0) {
      try {
        const variationIds = product.variations.map((v) => v.variationId);
        inventoryMap = await checkBulkInventory(variationIds);

        // Update variations with inventory data
        product.variations = product.variations.map((v) => ({
          ...v,
          inStock: (inventoryMap[v.variationId] || 0) > 0,
          quantity: inventoryMap[v.variationId] || 0,
        }));
      } catch (error) {
        console.error("Inventory check failed:", error);
        // Default to in stock if inventory check fails
        product.variations = product.variations.map((v) => ({
          ...v,
          inStock: true,
          quantity: 999,
        }));
      }
    } else {
      // Single variation product
      const quantity = inventoryMap[product.variationId] || 999;
      product.variations = [
        {
          id: product.variationId,
          variationId: product.variationId,
          name: product.title,
          price: product.price,
          inStock: quantity > 0,
          quantity: quantity,
          attributes: {},
        },
      ];
    }

    return new Response(JSON.stringify(product), {
      headers: { 
        'Content-Type': 'application/json',
        // Browser: Cache for 1 minute
        'Cache-Control': 'public, max-age=60, must-revalidate',
        // Netlify CDN: Fresh for 5 minutes, stale for 1 hour
        'Netlify-CDN-Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600, durable',
        // Cache tag for invalidation
        'Netlify-Cache-Tag': `product-${productId},products,quick-view`
      },
    });
  } catch (error) {
    const appError = processSquareError(error, "quick-view-product");
    logError(appError);

    return new Response(
      JSON.stringify({
        error: "Failed to fetch product",
        details: appError.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
