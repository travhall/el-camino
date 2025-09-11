// src/pages/api/get-categories.ts
import type { APIRoute } from "astro";
import { squareClient, jsonStringifyReplacer } from "@/lib/square/client";
import type { CatalogObject } from "square/legacy";

export const GET: APIRoute = async ({ request }) => {
  const startTime = Date.now();
  
  try {
    // Check if request includes cache headers to determine if this might be cached
    const cacheControl = request.headers.get('cache-control');
    const ifNoneMatch = request.headers.get('if-none-match');
    const wasCached = cacheControl?.includes('max-age') && !cacheControl?.includes('no-cache');
    
    // console.log("Fetching Square categories...");

    // Fetch all categories
    const categoryResponse = await squareClient.catalogApi.listCatalog(
      undefined,
      "CATEGORY"
    );

    if (!categoryResponse.result?.objects?.length) {
      const responseTime = Date.now() - startTime;
      
      return new Response(
        JSON.stringify(
          {
            success: false,
            error: "No categories found",
            categories: [],
            _meta: { responseTime, cached: false }
          },
          jsonStringifyReplacer
        ),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Process categories
    const categories = categoryResponse.result.objects
      .filter((obj: CatalogObject) => obj.type === "CATEGORY")
      .map((obj: CatalogObject) => ({
        id: obj.id,
        type: obj.type,
        version: obj.version,
        name: obj.categoryData?.name,
        categoryData: obj.categoryData,
      }));

    // Fetch some items to examine category relationships
    const itemResponse = await squareClient.catalogApi.listCatalog(
      undefined,
      "ITEM"
    );

    // Process item-category relationships
    const itemCategories =
      itemResponse.result?.objects
        ?.slice(0, 10) // Limit to 10 items
        .filter((obj: CatalogObject) => obj.type === "ITEM")
        .map((obj: CatalogObject) => ({
          itemId: obj.id,
          itemName: obj.itemData?.name,
          categoryId: obj.itemData?.categoryId,
          categories: obj.itemData?.categories,
          itemData: obj.itemData,
        })) || [];

    const responseTime = Date.now() - startTime;

    return new Response(
      JSON.stringify(
        {
          success: true,
          categories,
          itemCategories,
          _meta: { responseTime, cached: wasCached }
        },
        jsonStringifyReplacer,
        2
      ),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=120, s-maxage=300, stale-while-revalidate=600",
          "Netlify-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
          "Vary": "Accept-Encoding",
          "X-Response-Time": responseTime.toString()
        },
      }
    );
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error("Error fetching categories:", error);
    return new Response(
      JSON.stringify(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch categories",
          _meta: { responseTime, cached: false }
        },
        jsonStringifyReplacer
      ),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "X-Response-Time": responseTime.toString()
        },
      }
    );
  }
};
