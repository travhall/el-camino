// src/lib/square/productUtils.ts
// Shared utilities used by both client.ts and categories.ts
import { squareClient } from "./client";
import { measurementUnitCache } from "@/lib/cache/blobCache";

/**
 * Extract brand value from item-level custom attributes
 */
export function extractBrandValue(customAttributeValues: any): string {
  if (!customAttributeValues) return "";

  const brandAttribute = Object.values(customAttributeValues).find(
    (attr: any) =>
      attr?.name?.toLowerCase() === "brand" ||
      attr?.key?.toLowerCase() === "brand"
  ) as any;

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
export function extractIsGiftCard(customAttributeValues: any): boolean {
  if (!customAttributeValues) return false;

  const attr = Object.values(customAttributeValues).find(
    (a: any) =>
      a?.name?.toLowerCase() === "isgiftcard" ||
      a?.key?.toLowerCase() === "isgiftcard"
  ) as any;

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

/**
 * Batch-fetch measurement unit names from Square, cached via BlobCache to
 * survive cold starts across serverless function instances.
 * @param unitIds Array of Square measurement unit catalog object IDs
 * @returns Map of unit ID → human-readable unit name
 */
export async function fetchMeasurementUnits(
  unitIds: string[]
): Promise<Record<string, string>> {
  if (!unitIds.length) return {};

  const uniqueIds = [...new Set(unitIds)];
  const cacheKey = uniqueIds.sort().join(",");

  return measurementUnitCache.getOrCompute(cacheKey, async () => {
    const results = await Promise.allSettled(
      uniqueIds.map(async (unitId) => {
        try {
          const result = await squareClient.catalog.object.get({ objectId: unitId });

          if ((result as any).object?.type === "MEASUREMENT_UNIT") {
            const unitData = (result as any).object.measurementUnitData;
            let unitName = "";

            if (unitData?.measurementUnit?.customUnit?.name) {
              unitName = unitData.measurementUnit.customUnit.name;
            } else if (unitData?.measurementUnit?.customUnit?.abbreviation) {
              unitName = unitData.measurementUnit.customUnit.abbreviation;
            } else if (unitData?.measurementUnit?.type) {
              unitName = unitData.measurementUnit.type
                .toLowerCase()
                .replace(/_/g, " ");
            }

            return { unitId, unitName };
          }
          return { unitId, unitName: "" };
        } catch {
          return { unitId, unitName: "" };
        }
      })
    );

    const unitMap: Record<string, string> = {};
    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value.unitName) {
        unitMap[result.value.unitId] = result.value.unitName;
      }
    });

    return unitMap;
  });
}
