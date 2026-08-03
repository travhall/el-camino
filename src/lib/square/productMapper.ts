import type { CatalogObject } from "square-legacy";
import type { Product } from "./types";
import { extractBrandValue, extractIsGiftCard, extractSaleInfo } from "./catalogUtils";
import { buildAvailableAttributes } from "./variationParser";
import { createProductUrl } from "./slugUtils";
import { EL_CAMINO_LOGO_DATA_URI } from "@/lib/constants/assets";

type CatalogItemVariation = CatalogObject.ItemVariation;

function isItemVariation(obj: CatalogObject): obj is CatalogItemVariation {
  return obj.type === "ITEM_VARIATION";
}

function sortByOrdinal(
  a: CatalogItemVariation,
  b: CatalogItemVariation
): number {
  const ordA = a.itemVariationData?.ordinal ?? 0;
  const ordB = b.itemVariationData?.ordinal ?? 0;
  return ordA - ordB;
}

function extractBrandFromTitle(title: string): string {
  const knownBrands = [
    "spitfire",
    "thrasher",
    "krooked",
    "real",
    "baker",
    "toy machine",
    "independent",
    "thunder",
    "ace",
    "venture",
    "bones",
    "girl",
    "chocolate",
    "anti-hero",
    "creature",
    "santa cruz",
    "powell peralta",
    "element",
    "plan b",
    "flip",
    "zero",
    "mystery",
    "blind",
    "world industries",
    "skeleton key",
    "jacuzzi unlimited",
    "sci-fi fantasy",
    "bronze",
    "slappy",
    "huf",
    "vans",
    "nike sb",
    "adidas",
    "converse",
  ];

  const titleLower = title.toLowerCase();

  for (const brand of knownBrands) {
    if (titleLower.startsWith(brand.toLowerCase())) {
      return brand.replace(/\s+/g, "");
    }
  }

  return title.split(" ")[0] || "UNKNOWN";
}

export function generateHumanReadableSku(
  title: string,
  brand?: string,
  variationName?: string
): string {
  const brandPart = brand || extractBrandFromTitle(title);

  const titlePart = title
    .replace(new RegExp(`^${brandPart}\\s*`, "i"), "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(" ")
    .filter((word) => word.length > 0)
    .map((word) => word.toUpperCase())
    .slice(0, 3)
    .join("-");

  const variationPart =
    variationName && variationName.trim() && variationName !== title
      ? `-${variationName
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .split(" ")
          .slice(0, 2)
          .join("-")
          .toUpperCase()}`
      : "";

  return `${brandPart.toUpperCase()}-${titlePart}${variationPart}`;
}

/**
 * Collect image IDs and measurement unit IDs from raw catalog objects for
 * batch-fetching before mapping. Mirrors the existing fetchProducts behavior:
 * only the first variation's measurementUnitId is collected per item.
 */
export function collectBulkFetchIds(allObjects: CatalogObject[]): {
  imageIds: string[];
  measurementUnitIds: string[];
} {
  const items = allObjects.filter(
    (obj): obj is CatalogObject.Item => obj.type === "ITEM"
  );

  const productImageIds = items
    .map((item) => item.itemData?.imageIds?.[0])
    .filter(Boolean) as string[];

  const variationImageIds = items
    .flatMap((item) => item.itemData?.variations ?? [])
    .filter(isItemVariation)
    .flatMap((v) => v.itemVariationData?.imageIds ?? []);

  const imageIds = [...new Set([...productImageIds, ...variationImageIds])];

  const measurementUnitIds = items
    .map((item) => {
      const first = item.itemData?.variations?.[0];
      return first && isItemVariation(first)
        ? first.itemVariationData?.measurementUnitId
        : undefined;
    })
    .filter(Boolean) as string[];

  return { imageIds, measurementUnitIds };
}

export function mapCatalogItemsToProducts(
  allObjects: CatalogObject[],
  imageUrlMap: Record<string, string>,
  measurementUnitsMap: Record<string, string>
): Product[] {
  const productsWithBasicInfo = allObjects
    .filter((obj): obj is CatalogObject.Item => obj.type === "ITEM")
    .map((item) => {
      const firstVariationRaw = item.itemData?.variations?.[0];
      const variation =
        firstVariationRaw && isItemVariation(firstVariationRaw)
          ? firstVariationRaw
          : undefined;
      const priceMoney = variation?.itemVariationData?.priceMoney;
      const brandValue = extractBrandValue(item.customAttributeValues);
      const isGiftCard = extractIsGiftCard(item.customAttributeValues);

      return {
        id: item.id,
        catalogObjectId: item.id,
        variationId: variation?.id || item.id,
        title: item.itemData?.name || "",
        description: item.itemData?.description || "",
        imageId: item.itemData?.imageIds?.[0] || null,
        measurementUnitId: variation?.itemVariationData?.measurementUnitId || null,
        price: priceMoney ? Number(priceMoney.amount) / 100 : 0,
        brand: brandValue,
        isGiftCard: isGiftCard || undefined,
        categoryIds: (item.itemData?.categories || [])
          .map((c) => c.id)
          .filter((id): id is string => Boolean(id)),
        reportingCategoryId: item.itemData?.reportingCategory?.id || null,
      };
    });

  // Build an id-keyed Map so the inner .map() is O(1) per lookup, not O(n)
  const allObjectsById = new Map(allObjects.map((obj) => [obj.id, obj]));

  return productsWithBasicInfo.map((p) => {
    const item = allObjectsById.get(p.id);
    const variations = (
      item?.type === "ITEM" ? item.itemData?.variations : undefined
    )?.filter(isItemVariation) ?? [];
    const variation = variations[0];
    const actualSku = variation?.itemVariationData?.sku || "";

    const humanReadableSku = generateHumanReadableSku(
      p.title,
      p.brand,
      variation?.itemVariationData?.name || undefined
    );

    const productVariations = variations
      .slice()
      .sort(sortByOrdinal)
      .map((v) => {
        const variationPrice = v.itemVariationData?.priceMoney;
        const regularPrice = variationPrice ? Number(variationPrice.amount) / 100 : 0;
        const saleInfo = extractSaleInfo(v.customAttributeValues, regularPrice);
        const rawVariationImageIds: string[] = v.itemVariationData?.imageIds ?? [];
        const variationImageUrls = rawVariationImageIds
          .map((id: string) => imageUrlMap[id])
          .filter((url): url is string => !!url && url !== EL_CAMINO_LOGO_DATA_URI);

        return {
          id: v.id,
          variationId: v.id,
          name: v.itemVariationData?.name || "",
          price: regularPrice,
          image: variationImageUrls[0],
          images: variationImageUrls.length > 1 ? variationImageUrls : undefined,
          saleInfo: saleInfo || undefined,
        };
      });

    return {
      id: p.id,
      catalogObjectId: p.catalogObjectId,
      variationId: p.variationId,
      title: p.title,
      description: p.description,
      image:
        p.imageId && imageUrlMap[p.imageId]
          ? imageUrlMap[p.imageId]
          : EL_CAMINO_LOGO_DATA_URI,
      price: p.price,
      url: createProductUrl({ title: p.title }),
      brand: p.brand || undefined,
      unit: p.measurementUnitId
        ? measurementUnitsMap[p.measurementUnitId] || undefined
        : undefined,
      sku: actualSku || undefined,
      humanReadableSku: humanReadableSku,
      variations: productVariations.length > 0 ? productVariations : undefined,
      categories: p.categoryIds?.length > 0 ? p.categoryIds : undefined,
      reportingCategoryId: p.reportingCategoryId || undefined,
      isGiftCard: p.isGiftCard || undefined,
    };
  });
}

export function mapSingleCatalogItemToProduct(
  item: CatalogObject.Item,
  imageUrl: string,
  allImageUrls: string[],
  variationImages: Record<string, string>,
  unitsMap: Record<string, string>
): Product | null {
  const variations = (item.itemData?.variations || []).filter(isItemVariation);

  const defaultVariation = variations[0];
  const defaultPriceMoney = defaultVariation?.itemVariationData?.priceMoney;

  if (!defaultVariation || !defaultPriceMoney) return null;

  const productVariations = variations
    .slice()
    .sort(sortByOrdinal)
    .map((v) => {
      const priceMoney = v.itemVariationData?.priceMoney;
      const regularPrice = priceMoney ? Number(priceMoney.amount) / 100 : 0;

      const rawVariationImageIds: string[] = v.itemVariationData?.imageIds ?? [];
      const variationImageUrls: string[] = rawVariationImageIds
        .map((imgId: string) => variationImages[imgId])
        .filter((url): url is string => !!url && url !== EL_CAMINO_LOGO_DATA_URI);
      const variationImageUrl = variationImageUrls[0];

      const unit = v.itemVariationData?.measurementUnitId
        ? unitsMap[v.itemVariationData.measurementUnitId] || ""
        : "";

      const saleInfo = extractSaleInfo(v.customAttributeValues, regularPrice);

      return {
        id: v.id,
        variationId: v.id,
        name: v.itemVariationData?.name || "",
        price: regularPrice,
        image: variationImageUrl,
        images: variationImageUrls.length > 1 ? variationImageUrls : undefined,
        unit: unit || undefined,
        saleInfo: saleInfo || undefined,
      };
    });

  const availableAttributes = buildAvailableAttributes(productVariations);
  const brandValue = extractBrandValue(item.customAttributeValues);
  const isGiftCard = extractIsGiftCard(item.customAttributeValues);
  const defaultUnit = productVariations[0]?.unit ?? "";
  const categoryIds = (item.itemData?.categories || [])
    .map((c) => c.id)
    .filter((id): id is string => Boolean(id));

  return {
    id: item.id,
    catalogObjectId: item.id,
    variationId: defaultVariation.id,
    title: item.itemData?.name || "",
    description: item.itemData?.description || "",
    image: imageUrl,
    images: allImageUrls.length > 0 ? allImageUrls : undefined,
    price: Number(defaultPriceMoney.amount) / 100,
    url: createProductUrl({ title: item.itemData?.name || "" }),
    variations: productVariations,
    selectedVariationId: defaultVariation.id,
    brand: brandValue || undefined,
    unit: defaultUnit,
    availableAttributes: availableAttributes,
    isGiftCard: isGiftCard || undefined,
    categories: categoryIds.length > 0 ? categoryIds : undefined,
  };
}
