// src/pages/api/calculate-cart.ts
import type { APIRoute } from "astro";
import type { CartItem } from "@/lib/cart/types";
import { squareClient } from "@/lib/square/client";
import { calculateShippingRate } from "@/lib/config/shipping";
import { getAuthoritativePricing } from "@/lib/square/pricing";

interface CalculateRequest {
  items: CartItem[];
  fulfillmentMethod: "shipping" | "pickup";
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { items, fulfillmentMethod } = (await request.json()) as CalculateRequest;

    if (!items?.length) {
      return new Response(
        JSON.stringify({ 
          success: false,
          subtotal: 0,
          shipping: 0,
          tax: 0,
          total: 0
        }),
        { status: 200 }
      );
    }

    // Server-authoritative pricing: re-derive every price from the Square
    // catalog. The client cart (and its client-supplied sale pricing) is
    // attacker-controlled via localStorage, so it is NEVER trusted for
    // pricing — only for choosing WHICH variation and quantity to preview.
    const pricedVariationIds = items
      .filter((item) => !item.isGiftCard)
      .map((item) => item.variationId);
    const pricing = await getAuthoritativePricing(pricedVariationIds);

    // Calculate subtotal using server-derived effective prices, falling back
    // to the catalog regular price (item.price) when no trusted entry exists
    // (e.g. variable-price gift cards).
    const subtotal = items.reduce((sum, item) => {
      const effectivePrice = pricing[item.variationId]?.effectivePrice ?? item.price;
      return sum + effectivePrice * item.quantity;
    }, 0);

    // Calculate shipping
    let shippingCost = 0;
    if (fulfillmentMethod === "shipping") {
      const rate = calculateShippingRate(subtotal);
      shippingCost = rate.rate;
    }

    // Build line items - apply a sale price ONLY when the Square catalog
    // confirms an active sale for this variation.
    const lineItems = items.map((item) => {
      const lineItem: any = {
        quantity: String(item.quantity),
        catalogObjectId: item.variationId,
        itemType: "ITEM" as const,
      };

      const salePrice = pricing[item.variationId]?.salePrice;
      if (salePrice) {
        lineItem.basePriceMoney = {
          amount: BigInt(Math.round(salePrice * 100)),
          currency: "USD",
        };
      }

      return lineItem;
    });

    // Add shipping as line item if applicable
    if (shippingCost > 0) {
      lineItems.push({
        quantity: "1",
        itemType: "ITEM" as const,
        name: "Shipping",
        basePriceMoney: {
          amount: BigInt(Math.round(shippingCost * 100)),
          currency: "USD",
        },
      } as any);
    }

    // Call Square CalculateOrder to get real tax
    const calculateResponse = await squareClient.orders.calculate({
      order: {
        locationId: import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
        lineItems,
        pricingOptions: {
          autoApplyTaxes: true,
        },
      },
    });

    const order = calculateResponse.order;
    
    if (!order) {
      throw new Error("Calculate order failed");
    }

    // Extract calculated values
    const taxAmount = Number(order.totalTaxMoney?.amount || 0) / 100;
    const totalAmount = Number(order.totalMoney?.amount || 0) / 100;

    return new Response(
      JSON.stringify({
        success: true,
        subtotal,
        shipping: shippingCost,
        tax: taxAmount,
        total: totalAmount,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Calculate cart error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unable to calculate cart total. Please try again.",
      }),
      { status: 500 }
    );
  }
};
