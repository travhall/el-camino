// src/lib/square/catalogUtils.ts
// Custom-attribute and catalog serialization helpers shared by client.ts,
// productUtils.ts, and categories.ts. Kept dependency-free of squareClient so
// this file can be imported by both sides of the client.ts/productUtils.ts
// pair without recreating a circular import.
import type { SaleInfo, SquareCatalogCustomAttributes } from "./types";

export const jsonStringifyReplacer = (_key: string, value: any) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};

/**
 * Extract sale information from variation custom attributes
 * @param customAttributeValues - Variation-level custom attributes
 * @param regularPrice - Regular price from priceMoney (in dollars)
 * @returns SaleInfo object or null if no valid sale pricing
 */
export function extractSaleInfo(
  customAttributeValues: SquareCatalogCustomAttributes | null | undefined,
  regularPrice: number
): SaleInfo | null {
  if (!customAttributeValues) return null;

  // Look for sale_price attribute
  const salePriceAttr = Object.values(customAttributeValues).find(
    (attr) =>
      attr?.name?.toLowerCase() === "sale price" ||
      attr?.key?.toLowerCase() === "sale_price"
  );

  if (!salePriceAttr || salePriceAttr.type !== "NUMBER") return null;

  // Parse sale price (Square stores as string)
  const salePrice = salePriceAttr.numberValue
    ? Number(salePriceAttr.numberValue)
    : null;

  if (!salePrice || salePrice <= 0 || salePrice >= regularPrice) return null;

  // Calculate discount percentage
  const discountPercent = Math.round(
    ((regularPrice - salePrice) / regularPrice) * 100
  );

  // Optional: Extract sale end date
  const saleEndDateAttr = Object.values(customAttributeValues).find(
    (attr) =>
      attr?.name?.toLowerCase() === "sale end date" ||
      attr?.key?.toLowerCase() === "sale_end_date"
  );

  const saleEndDate =
    saleEndDateAttr?.type === "STRING" && saleEndDateAttr.stringValue
      ? saleEndDateAttr.stringValue
      : undefined;

  const saleInfoResult = {
    salePrice,
    originalPrice: regularPrice,
    discountPercent,
    saleEndDate,
  };

  return saleInfoResult;
}

/**
 * Extract brand value from item-level custom attributes
 */
export function extractBrandValue(
  customAttributeValues: SquareCatalogCustomAttributes | null | undefined
): string {
  if (!customAttributeValues) return "";

  const brandAttribute = Object.values(customAttributeValues).find(
    (attr) =>
      attr?.name?.toLowerCase() === "brand" ||
      attr?.key?.toLowerCase() === "brand"
  );

  if (
    brandAttribute &&
    brandAttribute.type === "STRING" &&
    brandAttribute.stringValue
  ) {
    return brandAttribute.stringValue;
  }

  return "";
}

/**
 * Detect physical gift cards via item-level custom attribute.
 * Tyler sets isGiftCard: true in Square Dashboard → Custom attributes.
 * Keyed by name or key to survive any Square attribute definition rename.
 */
export function extractIsGiftCard(
  customAttributeValues: SquareCatalogCustomAttributes | null | undefined
): boolean {
  if (!customAttributeValues) return false;

  const attr = Object.values(customAttributeValues).find(
    (a) =>
      a?.name?.toLowerCase() === "isgiftcard" ||
      a?.key?.toLowerCase() === "isgiftcard"
  );

  if (!attr) return false;

  // Boolean type
  if (attr.type === "BOOLEAN") return attr.booleanValue === true;

  // String fallback: "true", "yes", "1"
  if (attr.type === "STRING") {
    return ["true", "yes", "1"].includes(
      (attr.stringValue ?? "").toLowerCase()
    );
  }

  return false;
}
