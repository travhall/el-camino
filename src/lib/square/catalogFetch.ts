import { squareClient } from "./squareInstance";
import { logger } from "@/lib/logger";

const MAX_CATALOG_PAGES = 20;

export async function fetchAllCatalogItems(): Promise<any[]> {
  const allObjects: any[] = [];
  let cursor: string | undefined = undefined;
  let requestCount = 0;

  do {
    requestCount++;
    if (requestCount > MAX_CATALOG_PAGES) {
      logger.warn(`[fetchProducts] Hit max requests limit (${MAX_CATALOG_PAGES})`);
      break;
    }
    const page = await squareClient.catalog.list({ types: "ITEM", cursor });
    if (page.data?.length) {
      allObjects.push(...page.data);
    }
    cursor = page.response.cursor;
  } while (cursor);

  return allObjects;
}

export async function fetchCatalogItemById(id: string) {
  return squareClient.catalog.object.get({
    objectId: id,
    includeRelatedObjects: true,
  });
}
