/**
 * productUtils.fetchMeasurementUnits unit tests (plan 222)
 *
 * Units resolve through one `catalog.batchGet` instead of one
 * `catalog.object.get` per unit; a failed batch falls back to per-id lookups.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockBatchGet, mockObjectGet, mockGetOrCompute } = vi.hoisted(() => ({
  mockBatchGet: vi.fn(),
  mockObjectGet: vi.fn(),
  mockGetOrCompute: vi.fn(),
}));

vi.mock('../client', () => ({
  squareClient: {
    catalog: { batchGet: mockBatchGet, object: { get: mockObjectGet } },
  },
}));

vi.mock('@/lib/cache/blobCache', () => ({
  measurementUnitCache: { getOrCompute: mockGetOrCompute },
}));

import { fetchMeasurementUnits } from '../productUtils';

const unit = (id: string, measurementUnit: Record<string, unknown>) => ({
  id,
  type: 'MEASUREMENT_UNIT',
  measurementUnitData: { measurementUnit },
});

beforeEach(() => {
  vi.clearAllMocks();
  // Cache miss: run the compute function.
  mockGetOrCompute.mockImplementation(
    async (_key: string, compute: () => Promise<unknown>) => compute()
  );
});

describe('fetchMeasurementUnits', () => {
  it('returns {} and calls nothing for an empty list', async () => {
    expect(await fetchMeasurementUnits([])).toEqual({});
    expect(mockGetOrCompute).not.toHaveBeenCalled();
    expect(mockBatchGet).not.toHaveBeenCalled();
  });

  it('resolves all units with one batchGet and no per-id GETs', async () => {
    mockBatchGet.mockResolvedValue({
      objects: [
        unit('u1', { customUnit: { name: 'Pair', abbreviation: 'pr' } }),
        unit('u2', { customUnit: { abbreviation: 'ea' } }),
        unit('u3', { type: 'TYPE_IMPERIAL_LENGTH' }),
      ],
    });

    const result = await fetchMeasurementUnits(['u3', 'u1', 'u2', 'u1']);

    expect(mockBatchGet).toHaveBeenCalledTimes(1);
    expect(mockBatchGet).toHaveBeenCalledWith({
      objectIds: ['u1', 'u2', 'u3'],
    });
    expect(mockObjectGet).not.toHaveBeenCalled();
    expect(result).toEqual({
      u1: 'Pair',
      u2: 'ea',
      u3: 'type imperial length',
    });
  });

  it('omits ids that are missing, not units, or have no name', async () => {
    mockBatchGet.mockResolvedValue({
      objects: [{ id: 'u2', type: 'ITEM' }, unit('u3', {})],
    });

    expect(await fetchMeasurementUnits(['u1', 'u2', 'u3'])).toEqual({});
    expect(mockObjectGet).not.toHaveBeenCalled();
  });

  it('falls back to per-id lookups when the batch call fails', async () => {
    mockBatchGet.mockRejectedValue(new Error('429'));
    mockObjectGet.mockImplementation(
      async ({ objectId }: { objectId: string }) =>
        objectId === 'u2'
          ? Promise.reject(new Error('gone'))
          : {
              object: unit(objectId, { customUnit: { name: `n-${objectId}` } }),
            }
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await fetchMeasurementUnits(['u1', 'u2']);

    expect(mockObjectGet).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ u1: 'n-u1' });
  });

  it('keys the cache on the sorted unique ids', async () => {
    mockBatchGet.mockResolvedValue({ objects: [] });

    await fetchMeasurementUnits(['b', 'a', 'b']);

    expect(mockGetOrCompute).toHaveBeenCalledWith('a,b', expect.any(Function));
  });
});
