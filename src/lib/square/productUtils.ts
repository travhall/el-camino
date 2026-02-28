// src/lib/square/productUtils.ts
// Shared utilities used by both client.ts and categories.ts
import { squareClient } from "./client";

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

// In-memory cache for measurement units (1-hour TTL)
const measurementUnitCache = new Map<
  string,
  { value: Record<string, string>; timestamp: number }
>();
const MEASUREMENT_UNIT_TTL = 3_600_000; // 1 hour in ms

/**
 * Batch-fetch measurement unit names from Square, with in-memory caching.
 * @param unitIds Array of Square measurement unit catalog object IDs
 * @returns Map of unit ID → human-readable unit name
 */
export async function fetchMeasurementUnits(
  unitIds: string[]
): Promise<Record<string, string>> {
  if (!unitIds.length) return {};

  const uniqueIds = [...new Set(unitIds)];
  const cacheKey = uniqueIds.sort().join(",");

  const cached = measurementUnitCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < MEASUREMENT_UNIT_TTL) {
    return cached.value;
  }

  const results = await Promise.allSettled(
    uniqueIds.map(async (unitId) => {
      try {
        const { result } = await squareClient.catalogApi.retrieveCatalogObject(
          unitId
        );

        if (result.object?.type === "MEASUREMENT_UNIT") {
          const unitData = result.object.measurementUnitData;
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

  measurementUnitCache.set(cacheKey, { value: unitMap, timestamp: Date.now() });

  return unitMap;
}
