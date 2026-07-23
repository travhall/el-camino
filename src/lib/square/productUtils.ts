// src/lib/square/productUtils.ts
// Shared utilities used by both client.ts and categories.ts
import { squareClient } from "./client";
import { measurementUnitCache } from "@/lib/cache/blobCache";

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
