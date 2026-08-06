/**
 * Spike proof-of-concept for plans/120-spike-auto-trigger-back-in-stock.md,
 * Step 3. Not part of the production suite — proves out "Candidate B" from
 * the plan's Step 2 Q2 (on-demand variationId -> productId resolution via
 * Square's catalog.object.get, then reuse getSubscriptionsForProduct)
 * against a known variationId, using mocked Square + blob responses.
 *
 * Cost per resolution, as exercised below: 1 Square catalog API call
 * (squareClient.catalog.object.get) + 1 blob `list` call + 1 blob `get`
 * call per matched subscriber (via getSubscriptionsForProduct) — no new
 * storage, no write-path changes, no unbounded scan.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BisSubscription } from '../../backInStock';

const mockCatalogObjectGet = vi.fn();

vi.mock('@/lib/square/client', () => ({
  squareClient: {
    catalog: {
      object: {
        get: mockCatalogObjectGet,
      },
    },
  },
}));

const mockSubStore = {
  get: vi.fn(),
  set: vi.fn(),
  setJSON: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};

vi.mock('@netlify/blobs', () => ({
  getStore: vi.fn(() => mockSubStore),
}));

function blobKey(productId: string, email: string) {
  return `${productId}/${email.toLowerCase().trim()}`;
}

const subA: BisSubscription = {
  email: 'a@example.com',
  productId: 'PROD1',
  productTitle: 'Baker Deck',
  variationId: 'VAR1',
  productUrl: '/product/baker-deck',
  submittedAt: '2026-01-01T00:00:00Z',
};

const subB: BisSubscription = {
  email: 'b@example.com',
  productId: 'PROD1',
  productTitle: 'Baker Deck',
  variationId: 'VAR1',
  productUrl: '/product/baker-deck',
  submittedAt: '2026-01-02T00:00:00Z',
};

/**
 * Candidate B from the plan: resolve a variationId to its parent product's
 * subscribers on demand, with no secondary index. Mirrors what a webhook
 * handler would call per transitioning variation in an event.
 */
async function resolveSubscribersForVariation(
  variationId: string
): Promise<BisSubscription[]> {
  const { squareClient } = await import('@/lib/square/client');
  const { getSubscriptionsForProduct } = await import('../../backInStock');

  const result = await squareClient.catalog.object.get({
    objectId: variationId,
  });
  const itemId = (result as { object?: { itemVariationData?: { itemId?: string } } })
    .object?.itemVariationData?.itemId;
  if (!itemId) return [];

  return getSubscriptionsForProduct(itemId);
}

describe('Plan 120 spike — variationId -> subscriber resolution (Candidate B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves a known variationId to its product\'s active subscribers', async () => {
    mockCatalogObjectGet.mockResolvedValue({
      object: {
        type: 'ITEM_VARIATION',
        itemVariationData: { itemId: 'PROD1' },
      },
    });
    mockSubStore.list.mockResolvedValue({
      blobs: [
        { key: blobKey(subA.productId, subA.email) },
        { key: blobKey(subB.productId, subB.email) },
      ],
    });
    mockSubStore.get.mockImplementation((key: string) =>
      Promise.resolve(key.endsWith(subA.email) ? subA : subB)
    );

    const subscribers = await resolveSubscribersForVariation('VAR1');

    expect(subscribers).toEqual([subA, subB]);
    // Cost accounting for the plan's writeup: exactly one Square API call
    // regardless of subscriber count, plus the same list+get cost the
    // existing manual send path already pays via getSubscriptionsForProduct.
    expect(mockCatalogObjectGet).toHaveBeenCalledTimes(1);
    expect(mockCatalogObjectGet).toHaveBeenCalledWith({ objectId: 'VAR1' });
    expect(mockSubStore.list).toHaveBeenCalledTimes(1);
  });

  it('returns no subscribers for a variation whose product has none', async () => {
    mockCatalogObjectGet.mockResolvedValue({
      object: {
        type: 'ITEM_VARIATION',
        itemVariationData: { itemId: 'PROD-NO-SUBS' },
      },
    });
    mockSubStore.list.mockResolvedValue({ blobs: [] });

    const subscribers = await resolveSubscribersForVariation('VAR2');

    expect(subscribers).toEqual([]);
  });

  it('returns no subscribers when Square has no itemId for the object (e.g. deleted variation)', async () => {
    mockCatalogObjectGet.mockResolvedValue({ object: undefined });

    const subscribers = await resolveSubscribersForVariation('VAR-DELETED');

    expect(subscribers).toEqual([]);
    expect(mockSubStore.list).not.toHaveBeenCalled();
  });
});
