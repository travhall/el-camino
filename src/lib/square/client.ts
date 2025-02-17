// /src/lib/square/client.ts
import { Client, Environment } from "square";
import type { Product } from "./types";

function validateEnvironment() {
  const missingVars = [];
  if (!import.meta.env.SQUARE_ACCESS_TOKEN) {
    missingVars.push("SQUARE_ACCESS_TOKEN");
  }
  if (!import.meta.env.PUBLIC_SQUARE_LOCATION_ID) {
    missingVars.push("PUBLIC_SQUARE_LOCATION_ID");
  }
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }
}

validateEnvironment();

export const squareClient = new Client({
  accessToken: import.meta.env.SQUARE_ACCESS_TOKEN!,
  environment: Environment.Sandbox,
  squareVersion: "2024-02-28",
});

export const jsonStringifyReplacer = (_key: string, value: any) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};

async function getImageUrl(imageId: string): Promise<string | null> {
  try {
    const { result } = await squareClient.catalogApi.retrieveCatalogObject(
      imageId
    );
    if (result.object?.type === "IMAGE") {
      return result.object.imageData?.url || null;
    }
    return null;
  } catch (error) {
    console.error("Error fetching image:", error);
    return null;
  }
}

export async function fetchProducts(): Promise<Product[]> {
  try {
    console.log("Fetching Square products...");
    const response = await squareClient.catalogApi.listCatalog(
      undefined,
      "ITEM"
    );

    if (!response.result) {
      console.error("No result in Square response:", response);
      return [];
    }

    console.log("Square API Response:", {
      success: !!response.result,
      objectCount: response.result.objects?.length || 0,
    });

    if (!response.result.objects?.length) {
      console.log("No products found in catalog");
      return [];
    }

    const products = await Promise.all(
      response.result.objects
        .filter((item) => {
          if (item.type !== "ITEM") {
            console.log("Filtered out non-ITEM type:", item.type);
            return false;
          }
          return true;
        })
        .map(async (item) => {
          const variation = item.itemData?.variations?.[0];
          const priceMoney = variation?.itemVariationData?.priceMoney;

          if (!variation || !priceMoney) {
            console.log("Product missing variation or price:", item.id);
          }

          let imageUrl = "/images/placeholder.png";
          if (item.itemData?.imageIds?.[0]) {
            try {
              const fetchedUrl = await getImageUrl(item.itemData.imageIds[0]);
              if (fetchedUrl) {
                imageUrl = fetchedUrl;
              }
            } catch (error) {
              console.error(
                "Error fetching image for product:",
                item.id,
                error
              );
            }
          }

          return {
            id: item.id,
            catalogObjectId: item.id,
            variationId: variation?.id || item.id,
            title: item.itemData?.name || "",
            description: item.itemData?.description || "",
            image: imageUrl,
            price: priceMoney ? Number(priceMoney.amount) / 100 : 0,
            url: `/product/${item.id}`,
          };
        })
    );

    console.log("Processed products:", {
      count: products.length,
      firstProduct: products[0]
        ? {
            id: products[0].id,
            title: products[0].title,
          }
        : null,
    });

    return products;
  } catch (error) {
    console.error("Error fetching Square products:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
    }
    return [];
  }
}

export async function fetchProduct(id: string): Promise<Product | null> {
  try {
    const { result } = await squareClient.catalogApi.retrieveCatalogObject(id);
    if (!result.object || result.object.type !== "ITEM") return null;

    const item = result.object;
    const variation = item.itemData?.variations?.[0];
    const priceMoney = variation?.itemVariationData?.priceMoney;

    if (!variation || !priceMoney) return null;

    let imageUrl = "/images/placeholder.png";
    if (item.itemData?.imageIds?.[0]) {
      const fetchedUrl = await getImageUrl(item.itemData.imageIds[0]);
      if (fetchedUrl) {
        imageUrl = fetchedUrl;
      }
    }

    return {
      id: item.id,
      catalogObjectId: item.id,
      variationId: variation.id,
      title: item.itemData?.name || "",
      description: item.itemData?.description || "",
      image: imageUrl,
      price: Number(priceMoney.amount) / 100,
      url: `/product/${item.id}`,
    };
  } catch (error) {
    console.error("Error fetching product:", error);
    return null;
  }
}
