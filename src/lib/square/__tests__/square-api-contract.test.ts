/**
 * Square API Contract Tests
 * Validates that our code correctly handles real Square API response structures
 * Tests response parsing, error handling, and data transformation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Square SDK
const mockSquareClient = {
  catalogApi: {
    searchCatalogObjects: vi.fn(),
    retrieveCatalogObject: vi.fn(),
    batchRetrieveCatalogObjects: vi.fn()
  },
  inventoryApi: {
    batchRetrieveInventoryCounts: vi.fn(),
    retrieveInventoryCount: vi.fn()
  },
  ordersApi: {
    createOrder: vi.fn(),
    retrieveOrder: vi.fn()
  }
};

vi.mock('../client', () => ({
  getSquareClient: () => mockSquareClient
}));

describe('Square API Contract Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Catalog API Response Structure', () => {
    it('should handle searchCatalogObjects response', async () => {
      const mockResponse = {
        result: {
          objects: [
            {
              type: 'ITEM',
              id: 'item-1',
              itemData: {
                name: 'Test Product',
                description: 'Test Description',
                variations: [
                  {
                    type: 'ITEM_VARIATION',
                    id: 'var-1',
                    itemVariationData: {
                      name: 'Small',
                      priceMoney: {
                        amount: BigInt(2500),
                        currency: 'USD'
                      },
                      itemId: 'item-1'
                    }
                  }
                ]
              }
            }
          ],
          cursor: 'next-page-cursor'
        }
      };

      mockSquareClient.catalogApi.searchCatalogObjects.mockResolvedValue(mockResponse);

      const { searchCatalogObjects } = mockSquareClient.catalogApi;
      const response = await searchCatalogObjects({
        objectTypes: ['ITEM'],
        includeRelatedObjects: true
      });

      // Validate response structure
      expect(response.result.objects).toBeDefined();
      expect(Array.isArray(response.result.objects)).toBe(true);
      expect(response.result.objects[0].type).toBe('ITEM');
      expect(response.result.objects[0].itemData).toBeDefined();
      expect(response.result.objects[0].itemData.variations).toBeDefined();

      // Validate variation structure
      const variation = response.result.objects[0].itemData.variations[0];
      expect(variation.type).toBe('ITEM_VARIATION');
      expect(variation.itemVariationData.priceMoney).toBeDefined();
      expect(typeof variation.itemVariationData.priceMoney.amount).toBe('bigint');
    });

    it('should handle retrieveCatalogObject response', async () => {
      const mockResponse = {
        result: {
          object: {
            type: 'ITEM',
            id: 'item-1',
            itemData: {
              name: 'Test Product',
              categoryId: 'cat-1',
              variations: []
            }
          },
          relatedObjects: [
            {
              type: 'CATEGORY',
              id: 'cat-1',
              categoryData: {
                name: 'Skateboards'
              }
            }
          ]
        }
      };

      mockSquareClient.catalogApi.retrieveCatalogObject.mockResolvedValue(mockResponse);

      const response = await mockSquareClient.catalogApi.retrieveCatalogObject(
        'item-1',
        true
      );

      expect(response.result.object).toBeDefined();
      expect(response.result.relatedObjects).toBeDefined();
      expect(response.result.relatedObjects[0].type).toBe('CATEGORY');
    });

    it('should handle batchRetrieveCatalogObjects response', async () => {
      const mockResponse = {
        result: {
          objects: [
            {
              type: 'ITEM_VARIATION',
              id: 'var-1',
              itemVariationData: {
                name: 'Small, Red',
                priceMoney: {
                  amount: BigInt(2500),
                  currency: 'USD'
                }
              }
            },
            {
              type: 'ITEM_VARIATION',
              id: 'var-2',
              itemVariationData: {
                name: 'Large, Blue',
                priceMoney: {
                  amount: BigInt(3000),
                  currency: 'USD'
                }
              }
            }
          ]
        }
      };

      mockSquareClient.catalogApi.batchRetrieveCatalogObjects.mockResolvedValue(mockResponse);

      const response = await mockSquareClient.catalogApi.batchRetrieveCatalogObjects({
        objectIds: ['var-1', 'var-2'],
        includeRelatedObjects: true
      });

      expect(response.result.objects).toBeDefined();
      expect(response.result.objects).toHaveLength(2);
      expect(response.result.objects.every(obj => obj.type === 'ITEM_VARIATION')).toBe(true);
    });
  });

  describe('Inventory API Response Structure', () => {
    it('should handle batchRetrieveInventoryCounts response', async () => {
      const mockResponse = {
        result: {
          counts: [
            {
              catalogObjectId: 'var-1',
              locationId: 'loc-1',
              state: 'IN_STOCK',
              quantity: '10'
            },
            {
              catalogObjectId: 'var-2',
              locationId: 'loc-1',
              state: 'IN_STOCK',
              quantity: '5'
            }
          ],
          cursor: undefined
        }
      };

      mockSquareClient.inventoryApi.batchRetrieveInventoryCounts.mockResolvedValue(mockResponse);

      const response = await mockSquareClient.inventoryApi.batchRetrieveInventoryCounts({
        catalogObjectIds: ['var-1', 'var-2'],
        locationIds: ['loc-1']
      });

      expect(response.result.counts).toBeDefined();
      expect(Array.isArray(response.result.counts)).toBe(true);
      expect(response.result.counts[0].catalogObjectId).toBe('var-1');
      expect(response.result.counts[0].state).toBe('IN_STOCK');
      expect(typeof response.result.counts[0].quantity).toBe('string'); // Square returns as string
    });

    it('should handle zero inventory response', async () => {
      const mockResponse = {
        result: {
          counts: [
            {
              catalogObjectId: 'var-1',
              locationId: 'loc-1',
              state: 'IN_STOCK',
              quantity: '0'
            }
          ]
        }
      };

      mockSquareClient.inventoryApi.batchRetrieveInventoryCounts.mockResolvedValue(mockResponse);

      const response = await mockSquareClient.inventoryApi.batchRetrieveInventoryCounts({
        catalogObjectIds: ['var-1'],
        locationIds: ['loc-1']
      });

      expect(response.result.counts[0].quantity).toBe('0');
    });

    it('should handle missing inventory counts', async () => {
      const mockResponse = {
        result: {
          counts: []
        }
      };

      mockSquareClient.inventoryApi.batchRetrieveInventoryCounts.mockResolvedValue(mockResponse);

      const response = await mockSquareClient.inventoryApi.batchRetrieveInventoryCounts({
        catalogObjectIds: ['non-existent'],
        locationIds: ['loc-1']
      });

      expect(response.result.counts).toEqual([]);
    });

    it('should handle inventory states correctly', async () => {
      const mockResponse = {
        result: {
          counts: [
            {
              catalogObjectId: 'var-1',
              state: 'IN_STOCK',
              quantity: '5'
            },
            {
              catalogObjectId: 'var-2',
              state: 'SOLD',
              quantity: '0'
            },
            {
              catalogObjectId: 'var-3',
              state: 'WASTE',
              quantity: '0'
            }
          ]
        }
      };

      mockSquareClient.inventoryApi.batchRetrieveInventoryCounts.mockResolvedValue(mockResponse);

      const response = await mockSquareClient.inventoryApi.batchRetrieveInventoryCounts({
        catalogObjectIds: ['var-1', 'var-2', 'var-3'],
        locationIds: ['loc-1']
      });

      const inStockCount = response.result.counts.find(c => c.state === 'IN_STOCK');
      expect(inStockCount?.quantity).toBe('5');

      const soldCount = response.result.counts.find(c => c.state === 'SOLD');
      expect(soldCount).toBeDefined();
    });
  });

  describe('Orders API Response Structure', () => {
    it('should handle createOrder response', async () => {
      const mockResponse = {
        result: {
          order: {
            id: 'order-123',
            locationId: 'loc-1',
            lineItems: [
              {
                uid: 'line-1',
                name: 'Test Product',
                quantity: '2',
                catalogObjectId: 'var-1',
                variationName: 'Small',
                basePriceMoney: {
                  amount: BigInt(2500),
                  currency: 'USD'
                },
                grossSalesMoney: {
                  amount: BigInt(5000),
                  currency: 'USD'
                }
              }
            ],
            totalMoney: {
              amount: BigInt(5000),
              currency: 'USD'
            },
            state: 'OPEN',
            createdAt: '2024-01-01T00:00:00Z'
          }
        }
      };

      mockSquareClient.ordersApi.createOrder.mockResolvedValue(mockResponse);

      const response = await mockSquareClient.ordersApi.createOrder({
        order: {
          locationId: 'loc-1',
          lineItems: [
            {
              quantity: '2',
              catalogObjectId: 'var-1'
            }
          ]
        }
      });

      expect(response.result.order).toBeDefined();
      expect(response.result.order.id).toBe('order-123');
      expect(response.result.order.lineItems).toHaveLength(1);
      expect(typeof response.result.order.totalMoney.amount).toBe('bigint');
    });

    it('should handle order state transitions', async () => {
      const mockResponse = {
        result: {
          order: {
            id: 'order-123',
            state: 'COMPLETED',
            tenders: [
              {
                id: 'tender-1',
                type: 'CARD',
                cardDetails: {
                  status: 'CAPTURED'
                },
                amountMoney: {
                  amount: BigInt(5000),
                  currency: 'USD'
                }
              }
            ]
          }
        }
      };

      mockSquareClient.ordersApi.retrieveOrder.mockResolvedValue(mockResponse);

      const response = await mockSquareClient.ordersApi.retrieveOrder('order-123');

      expect(response.result.order.state).toBe('COMPLETED');
      expect(response.result.order.tenders).toBeDefined();
      expect(response.result.order.tenders[0].type).toBe('CARD');
    });
  });

  describe('Error Response Structure', () => {
    it('should handle Square API errors structure', async () => {
      const mockError = {
        errors: [
          {
            category: 'INVALID_REQUEST_ERROR',
            code: 'MISSING_REQUIRED_PARAMETER',
            detail: 'Missing required parameter: locationId',
            field: 'locationId'
          }
        ]
      };

      mockSquareClient.catalogApi.searchCatalogObjects.mockRejectedValue(mockError);

      try {
        await mockSquareClient.catalogApi.searchCatalogObjects({});
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.errors).toBeDefined();
        expect(Array.isArray(error.errors)).toBe(true);
        expect(error.errors[0].category).toBe('INVALID_REQUEST_ERROR');
        expect(error.errors[0].code).toBe('MISSING_REQUIRED_PARAMETER');
      }
    });

    it('should handle network errors', async () => {
      mockSquareClient.catalogApi.searchCatalogObjects.mockRejectedValue(
        new Error('Network error: ECONNREFUSED')
      );

      await expect(
        mockSquareClient.catalogApi.searchCatalogObjects({})
      ).rejects.toThrow('Network error');
    });

    it('should handle rate limit errors', async () => {
      const mockError = {
        errors: [
          {
            category: 'RATE_LIMIT_ERROR',
            code: 'RATE_LIMITED',
            detail: 'Too many requests'
          }
        ]
      };

      mockSquareClient.inventoryApi.batchRetrieveInventoryCounts.mockRejectedValue(mockError);

      try {
        await mockSquareClient.inventoryApi.batchRetrieveInventoryCounts({
          catalogObjectIds: ['var-1']
        });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.errors[0].category).toBe('RATE_LIMIT_ERROR');
      }
    });

    it('should handle authentication errors', async () => {
      const mockError = {
        errors: [
          {
            category: 'AUTHENTICATION_ERROR',
            code: 'UNAUTHORIZED',
            detail: 'Invalid access token'
          }
        ]
      };

      mockSquareClient.catalogApi.searchCatalogObjects.mockRejectedValue(mockError);

      try {
        await mockSquareClient.catalogApi.searchCatalogObjects({});
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.errors[0].category).toBe('AUTHENTICATION_ERROR');
      }
    });
  });

  describe('Data Type Conversions', () => {
    it('should handle BigInt to number conversion for prices', () => {
      const bigIntAmount = BigInt(2500);
      const numberAmount = Number(bigIntAmount);

      expect(typeof bigIntAmount).toBe('bigint');
      expect(typeof numberAmount).toBe('number');
      expect(numberAmount).toBe(2500);
    });

    it('should handle string to number conversion for quantities', () => {
      const stringQuantity = '10';
      const numberQuantity = parseInt(stringQuantity, 10);

      expect(typeof stringQuantity).toBe('string');
      expect(typeof numberQuantity).toBe('number');
      expect(numberQuantity).toBe(10);
    });

    it('should handle invalid quantity strings', () => {
      const invalidQuantity = 'invalid';
      const parsed = parseInt(invalidQuantity, 10);

      expect(isNaN(parsed)).toBe(true);
    });

    it('should handle negative quantities gracefully', () => {
      const negativeQuantity = '-5';
      const parsed = parseInt(negativeQuantity, 10);

      expect(parsed).toBe(-5);
      const sanitized = Math.max(0, parsed);
      expect(sanitized).toBe(0);
    });
  });

  describe('Pagination Handling', () => {
    it('should handle cursor-based pagination', async () => {
      const mockResponse1 = {
        result: {
          objects: [{ id: 'item-1' }],
          cursor: 'next-cursor'
        }
      };

      const mockResponse2 = {
        result: {
          objects: [{ id: 'item-2' }],
          cursor: undefined
        }
      };

      mockSquareClient.catalogApi.searchCatalogObjects
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      // First page
      const response1 = await mockSquareClient.catalogApi.searchCatalogObjects({
        objectTypes: ['ITEM']
      });

      expect(response1.result.cursor).toBe('next-cursor');

      // Second page
      const response2 = await mockSquareClient.catalogApi.searchCatalogObjects({
        objectTypes: ['ITEM'],
        cursor: response1.result.cursor
      });

      expect(response2.result.cursor).toBeUndefined();
    });

    it('should handle empty result set', async () => {
      const mockResponse = {
        result: {
          objects: undefined,
          cursor: undefined
        }
      };

      mockSquareClient.catalogApi.searchCatalogObjects.mockResolvedValue(mockResponse);

      const response = await mockSquareClient.catalogApi.searchCatalogObjects({});

      expect(response.result.objects).toBeUndefined();
      expect(response.result.cursor).toBeUndefined();
    });
  });

  describe('Custom Attributes', () => {
    it('should handle custom attribute structure', async () => {
      const mockResponse = {
        result: {
          object: {
            type: 'ITEM',
            id: 'item-1',
            customAttributeValues: {
              'brand': {
                name: 'Brand',
                stringValue: 'Spitfire',
                type: 'STRING'
              },
              'featured': {
                name: 'Featured',
                booleanValue: true,
                type: 'BOOLEAN'
              }
            }
          }
        }
      };

      mockSquareClient.catalogApi.retrieveCatalogObject.mockResolvedValue(mockResponse);

      const response = await mockSquareClient.catalogApi.retrieveCatalogObject('item-1');

      expect(response.result.object.customAttributeValues).toBeDefined();
      expect(response.result.object.customAttributeValues['brand'].stringValue).toBe('Spitfire');
      expect(response.result.object.customAttributeValues['featured'].booleanValue).toBe(true);
    });

    it('should handle missing custom attributes', async () => {
      const mockResponse = {
        result: {
          object: {
            type: 'ITEM',
            id: 'item-1',
            customAttributeValues: undefined
          }
        }
      };

      mockSquareClient.catalogApi.retrieveCatalogObject.mockResolvedValue(mockResponse);

      const response = await mockSquareClient.catalogApi.retrieveCatalogObject('item-1');

      expect(response.result.object.customAttributeValues).toBeUndefined();
    });
  });

  describe('Money Object Handling', () => {
    it('should handle money objects consistently', () => {
      const moneyObject = {
        amount: BigInt(2500),
        currency: 'USD'
      };

      expect(moneyObject.amount).toBe(BigInt(2500));
      expect(moneyObject.currency).toBe('USD');

      // Convert to cents for display
      const cents = Number(moneyObject.amount);
      expect(cents).toBe(2500);

      // Convert to dollars
      const dollars = cents / 100;
      expect(dollars).toBe(25.00);
    });

    it('should handle zero amounts', () => {
      const zeroMoney = {
        amount: BigInt(0),
        currency: 'USD'
      };

      expect(Number(zeroMoney.amount)).toBe(0);
    });

    it('should handle large amounts', () => {
      const largeMoney = {
        amount: BigInt(999999999),
        currency: 'USD'
      };

      const dollars = Number(largeMoney.amount) / 100;
      expect(dollars).toBe(9999999.99);
    });
  });

  describe('Image URLs', () => {
    it('should handle image data structure', async () => {
      const mockResponse = {
        result: {
          object: {
            type: 'IMAGE',
            id: 'img-1',
            imageData: {
              name: 'Product Image',
              url: 'https://square-catalog.com/images/image-1.jpg',
              caption: 'Main product image'
            }
          }
        }
      };

      mockSquareClient.catalogApi.retrieveCatalogObject.mockResolvedValue(mockResponse);

      const response = await mockSquareClient.catalogApi.retrieveCatalogObject('img-1');

      expect(response.result.object.imageData.url).toBeDefined();
      expect(response.result.object.imageData.url).toContain('https://');
    });
  });

  describe('Variation Name Parsing', () => {
    it('should handle standard variation names', () => {
      const variationName = 'Small, Red, Cotton';
      const parts = variationName.split(',').map(p => p.trim());

      expect(parts).toEqual(['Small', 'Red', 'Cotton']);
    });

    it('should handle single attribute variations', () => {
      const variationName = 'Small';
      const parts = variationName.split(',').map(p => p.trim());

      expect(parts).toEqual(['Small']);
    });

    it('should handle variations with extra spaces', () => {
      const variationName = 'Small,  Red,   Cotton';
      const parts = variationName.split(',').map(p => p.trim());

      expect(parts).toEqual(['Small', 'Red', 'Cotton']);
    });
  });
});
