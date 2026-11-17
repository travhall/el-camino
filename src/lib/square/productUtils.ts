// src/lib/square/productUtils.ts
// Shared utilities used by both client.ts and categories.ts
import { squareClient } from './client';
import { measurementUnitCache } from '@/lib/cache/blobCache';
import type { CatalogObject } from 'square-legacy';
import { batchGetCatalogObjects } from './batchCatalog';

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
  const cacheKey = uniqueIds.sort().join(',');

  return measurementUnitCache.getOrCompute(cacheKey, async () => {
    const { objects, failedIds } = await batchGetCatalogObjects(uniqueIds);

    // A failed batch call must not lose units: retry just those ids one by one.
    await Promise.all(
      failedIds.map(async (unitId) => {
        try {
          const result = await squareClient.catalog.object.get({
            objectId: unitId,
          });
          if (result.object) objects.set(unitId, result.object);
        } catch {
          // Unit stays unresolved; the caller renders without it.
        }
      })
    );

    const unitMap: Record<string, string> = {};
    for (const [unitId, object] of objects) {
      const unitName = measurementUnitName(object);
      if (unitName) unitMap[unitId] = unitName;
    }
    return unitMap;
  });
}

function measurementUnitName(object: CatalogObject): string {
  if (object.type !== 'MEASUREMENT_UNIT') return '';
  const unit = object.measurementUnitData?.measurementUnit;
  if (unit?.customUnit?.name) return unit.customUnit.name;
  if (unit?.customUnit?.abbreviation) return unit.customUnit.abbreviation;
  if (unit?.type) return unit.type.toLowerCase().replace(/_/g, ' ');
  return '';
}
