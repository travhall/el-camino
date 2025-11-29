// src/pages/api/filter-metadata.ts
// PHASE 2: Lightweight filter metadata API for instant client-side filtering
import type { APIRoute } from "astro";
import { fetchProducts } from "@/lib/square/client";
import { fetchProductsByCategory } from "@/lib/square/categories";
import { batchInventoryService } from "@/lib/square/batchInventory";

export interface FilterMetadata {
  id: string;
  brand: string | null;
  isInStock: boolean;
  variationId: string;
  imageUrl: string | null;
  name: string;
  price: number;
  salePrice?: number;
}

export interface FilterMetadataResponse {
  products: FilterMetadata[];
  brands: string[];
  timestamp: number;
}

export const GET: APIRoute = async ({ url }) => {
  const categoryId = url.searchParams.get("category");

  try {
    // Fetch products (either all or by category)
    const products = categoryId
      ? await fetchProductsByCategory(categoryId, { limit: 200 })
      : await fetchProducts();

    // Extract variation IDs for batch inventory check
    const variationIds = products
      .map((p) => p.variationId)
      .filter(Boolean) as string[];

    // Batch inventory check
    const inventoryMap =
      await batchInventoryService.getBatchInventoryStatus(variationIds);

    // Build lightweight metadata
    const metadata: FilterMetadata[] = products.map((product) => {
      const inventoryStatus = inventoryMap.get(product.variationId) || {
        isOutOfStock: false,
        hasLimitedOptions: false,
        totalQuantity: 0,
      };

      return {
        id: product.id,
        brand: product.brand || null,
        isInStock: !inventoryStatus.isOutOfStock,
        variationId: product.variationId,
        imageUrl: product.imageUrl || null,
        name: product.name,
        price: product.price,
        salePrice: product.salePrice,
      };
    });

    // Extract unique brands
    const brands = [
      ...new Set(products.map((p) => p.brand).filter(Boolean)),
    ] as string[];

    const response: FilterMetadataResponse = {
      products: metadata,
      brands,
      timestamp: Date.now(),
    };

    // Cache for 2 minutes (same as filtered results)
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=120, s-max-age=180",
        "Netlify-CDN-Cache-Control": "public, s-max-age=180",
      },
    });
  } catch (error) {
    console.error("[FilterMetadata API] Error:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to fetch filter metadata",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};
