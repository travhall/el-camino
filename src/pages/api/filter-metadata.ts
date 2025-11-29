// src/pages/api/filter-metadata.ts
// PHASE 2: Lightweight filter metadata API for instant client-side filtering
import type { APIRoute } from "astro";
import type { Product } from "@/lib/square/types";
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
    const result = categoryId
      ? await fetchProductsByCategory(categoryId, { limit: 200 })
      : await fetchProducts();

    // Handle both PaginatedProducts and Product[] return types
    const productList: Product[] = Array.isArray(result) ? result : result.products;

    // Extract variation IDs for batch inventory check
    const variationIds = productList
      .map((p: Product) => p.variationId)
      .filter(Boolean) as string[];

    // Batch inventory check
    const inventoryMap =
      await batchInventoryService.getBatchInventoryStatus(variationIds);

    // Build lightweight metadata
    const metadata: FilterMetadata[] = productList.map((product: Product) => {
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
        imageUrl: product.image || null,
        name: product.title,
        price: product.price,
        salePrice: undefined, // Product type doesn't have salePrice at top level
      };
    });

    // Extract unique brands
    const brands = [
      ...new Set(productList.map((p: Product) => p.brand).filter(Boolean)),
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
