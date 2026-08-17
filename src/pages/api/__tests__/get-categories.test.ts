import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/square/client', () => ({
  squareClient: {
    catalog: {
      list: vi.fn(),
    },
  },
}));

import { GET } from '../get-categories';
import { squareClient } from '@/lib/square/client';

const listMock = squareClient.catalog.list as unknown as ReturnType<
  typeof vi.fn
>;

function makeContext(cacheControl?: string) {
  return {
    request: {
      headers: new Headers(
        cacheControl ? { 'cache-control': cacheControl } : {}
      ),
    },
  } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/get-categories', () => {
  it('returns success:false with an empty list when no categories exist', async () => {
    listMock.mockResolvedValue({ data: [] });
    const res = await GET(makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('No categories found');
    expect(body.categories).toEqual([]);
  });

  it('maps categories and the first 10 item-category relationships', async () => {
    listMock.mockImplementation(async ({ types }: { types: string }) => {
      if (types === 'CATEGORY') {
        return {
          data: [
            {
              id: 'cat1',
              type: 'CATEGORY',
              version: 1n,
              categoryData: { name: 'Decks' },
            },
          ],
        };
      }
      return {
        data: [
          {
            id: 'item1',
            type: 'ITEM',
            itemData: { name: 'Deck A', categoryId: 'cat1', categories: [] },
          },
        ],
      };
    });

    const res = await GET(makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.categories).toEqual([
      {
        id: 'cat1',
        type: 'CATEGORY',
        version: '1',
        name: 'Decks',
        categoryData: { name: 'Decks' },
      },
    ]);
    expect(body.itemCategories).toEqual([
      {
        itemId: 'item1',
        itemName: 'Deck A',
        categoryId: 'cat1',
        categories: [],
        itemData: { name: 'Deck A', categoryId: 'cat1', categories: [] },
      },
    ]);
  });

  it('marks cached=true when cache-control has max-age without no-cache', async () => {
    listMock.mockResolvedValue({
      data: [{ id: 'cat1', type: 'CATEGORY', categoryData: { name: 'Decks' } }],
    });
    const res = await GET(makeContext('max-age=120'));
    const body = await res.json();
    expect(body._meta.cached).toBe(true);
  });

  it('returns 500 with the error message when squareClient throws', async () => {
    listMock.mockRejectedValue(new Error('Square unavailable'));
    const res = await GET(makeContext());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({
      success: false,
      error: 'Square unavailable',
    });
  });
});
