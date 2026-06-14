import type { APIRoute } from "astro";
import { squareClient, jsonStringifyReplacer } from "@/lib/square/client";
import type { CatalogObject } from "square-legacy";

export const GET: APIRoute = async () => {
  try {
    // console.log('Fetching catalog items...');
    const catalogPage = await squareClient.catalog.list({ types: "ITEM" });

    const items =
      catalogPage.data
        ?.filter((item: CatalogObject) => item.type === "ITEM")
        .map((item: CatalogObject) => {
          const variations = (item as any).itemData?.variations || [];
          return {
            id: item.id,
            name: (item as any).itemData?.name,
            description: (item as any).itemData?.description,
            variations: variations.map((variation: any) => ({
              variationId: variation.id,
              name: variation.itemVariationData?.name,
              price: variation.itemVariationData?.priceMoney
                ? Number(variation.itemVariationData.priceMoney.amount) / 100
                : 0,
            })),
          };
        }) || [];

    return new Response(
      JSON.stringify(
        {
          success: true,
          locationId: import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
          items,
          meta: {
            totalItems: items.length,
            squareVersion: "2024-02-28",
          },
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
          "Vary": "Accept-Encoding"
        },
      }
    );
  } catch (error) {
    console.error("Catalog fetch error:", error);
    return new Response(
      JSON.stringify(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to fetch catalog",
          meta: {
            locationId: import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
          },
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
