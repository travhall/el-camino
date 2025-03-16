// src/pages/api/get-categories.ts
import type { APIRoute } from "astro";
import { squareClient, jsonStringifyReplacer } from "@/lib/square/client";
import type { CatalogObject } from "square";

export const GET: APIRoute = async () => {
  try {
    // console.log("Fetching Square categories...");

    // Fetch all categories
    const categoryResponse = await squareClient.catalogApi.listCatalog(
      undefined,
      "CATEGORY"
    );

    if (!categoryResponse.result?.objects?.length) {
      return new Response(
        JSON.stringify(
          {
            success: false,
            error: "No categories found",
            categories: [],
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

    return new Response(
      JSON.stringify(
        {
          success: true,
          categories,
          itemCategories,
        },
        jsonStringifyReplacer,
        2
      ),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching categories:", error);
    return new Response(
      JSON.stringify(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch categories",
        },
        jsonStringifyReplacer
      ),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
