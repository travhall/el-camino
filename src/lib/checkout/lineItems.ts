import type { OrderLineItem } from 'square-legacy';
import type { CartItem } from '@/lib/cart/types';
import type { AuthoritativePrice } from '@/lib/square/pricing';

export function buildLineItems(
  validItems: CartItem[],
  pricing: Record<string, AuthoritativePrice>,
  shippingRate: number,
  fulfillmentMethod: 'shipping' | 'pickup'
): OrderLineItem[] {
  const lineItems = validItems.map((item) => {
    const lineItem: OrderLineItem = {
      quantity: String(item.quantity),
      catalogObjectId: item.variationId,
      itemType: 'ITEM' as const,
    };

    // Apply a sale price ONLY when the Square catalog confirms an active sale
    // for this variation. Without an override Square charges the catalog's
    // regular price, so a missing or failed price lookup safely falls back to
    // full price rather than an attacker-supplied discount.
    const salePrice = pricing[item.variationId]?.salePrice;
    if (salePrice) {
      lineItem.basePriceMoney = {
        amount: BigInt(Math.round(salePrice * 100)), // Convert to cents
        currency: 'USD',
      };
    }

    return lineItem;
  });

  // Add shipping as a custom line item if shipping is selected
  if (fulfillmentMethod === 'shipping' && shippingRate > 0) {
    lineItems.push({
      quantity: '1',
      itemType: 'ITEM' as const,
      name: 'Shipping',
      basePriceMoney: {
        amount: BigInt(Math.round(shippingRate * 100)), // Convert to cents
        currency: 'USD',
      },
    });
  }

  return lineItems;
}
