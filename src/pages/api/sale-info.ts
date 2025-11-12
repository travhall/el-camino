import type { APIRoute } from "astro";
import { squareClient, extractSaleInfo } from "@/lib/square/client";
import type { SaleInfo } from "@/lib/square/types";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { variationIds } = await request.json();

    if (!Array.isArray(variationIds) || variationIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid variation IDs array",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { result } =
      await squareClient.catalogApi.batchRetrieveCatalogObjects({
        objectIds: variationIds,
        includeRelatedObjects: false,
      });

    const saleInfo: Record<string, SaleInfo | null> = {};

    for (const variationId of variationIds) {
      const catalogObject = result.objects?.find(
        (obj) => obj.id === variationId
      );

      if (!catalogObject || catalogObject.type !== "ITEM_VARIATION") {
        saleInfo[variationId] = null;
        continue;
      }

      const priceMoney = catalogObject.itemVariationData?.priceMoney;
      const regularPrice = priceMoney ? Number(priceMoney.amount) / 100 : 0;

      const extractedSaleInfo = extractSaleInfo(
        catalogObject.customAttributeValues,
        regularPrice
      );

      saleInfo[variationId] = extractedSaleInfo;
    }

    return new Response(
      JSON.stringify({
        success: true,
        saleInfo,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching sale info:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to fetch sale info",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
