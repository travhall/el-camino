// src/pages/api/calculate-cart.ts
import type { APIRoute } from "astro";
import { Client, Environment } from "square/legacy";
import type { CartItem } from "@/lib/cart/types";
import { calculateShippingRate } from "@/lib/config/shipping";

const squareClient = new Client({
  accessToken: import.meta.env.SQUARE_ACCESS_TOKEN || "",
  environment:
    import.meta.env.PUBLIC_SQUARE_ENVIRONMENT === "production"
      ? Environment.Production
      : Environment.Sandbox,
  squareVersion: "2024-02-28",
});

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

    // Calculate subtotal
    const subtotal = items.reduce((sum, item) => {
      const priceInDollars = (item.price || 0) / 100;
      return sum + priceInDollars * item.quantity;
    }, 0);

    // Calculate shipping
    let shippingCost = 0;
    if (fulfillmentMethod === "shipping") {
      const rate = calculateShippingRate(subtotal);
      shippingCost = rate.rate;
    }

    // Build line items
    const lineItems = items.map((item) => ({
      quantity: String(item.quantity),
      catalogObjectId: item.variationId,
      itemType: "ITEM" as const,
    }));

    // Add shipping as line item if applicable
    if (shippingCost > 0) {
      lineItems.push({
        quantity: "1",
        itemType: "ITEM" as const,
        name: "Shipping",
        basePriceMoney: {
          amount: Math.round(shippingCost * 100),
          currency: "USD",
        },
      } as any);
    }

    // Call Square CalculateOrder to get real tax
    const calculateResponse = await squareClient.ordersApi.calculateOrder({
      order: {
        locationId: import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
        lineItems,
        pricingOptions: {
          autoApplyTaxes: true,
        },
      },
    });

    const order = calculateResponse.result.order;
    
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
      })
    );
  } catch (error) {
    console.error("Calculate cart error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Calculation failed",
      }),
      { status: 500 }
    );
  }
};
