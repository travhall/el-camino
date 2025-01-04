// /api/create-checkout.ts
import type { APIRoute } from "astro";
import { Client, Environment } from "square";
import type { CartItem } from "@/lib/cart/types";

const squareClient = new Client({
  accessToken: import.meta.env.SQUARE_ACCESS_TOKEN || "",
  environment: Environment.Sandbox,
  squareVersion: "2024-02-28",
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const { items } = (await request.json()) as { items: CartItem[] };

    if (!items?.length) {
      return new Response(JSON.stringify({ error: "No items provided" }), {
        status: 400,
      });
    }

    // Create order first
    const orderResponse = await squareClient.ordersApi.createOrder({
      idempotencyKey: crypto.randomUUID(),
      order: {
        locationId: import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
        lineItems: items.map((item) => ({
          quantity: String(item.quantity),
          catalogObjectId: item.variationId,
          itemType: "ITEM",
        })),
      },
    });

    if (!orderResponse.result.order?.id) {
      throw new Error("Failed to create order");
    }

    const orderId = orderResponse.result.order.id;
    const confirmationUrl = new URL("/order-confirmation", request.url);
    confirmationUrl.searchParams.set("orderId", orderId);

    // Create payment link with order
    const linkResponse = await squareClient.checkoutApi.createPaymentLink({
      idempotencyKey: crypto.randomUUID(),
      order: {
        locationId: import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
        lineItems: items.map((item) => ({
          quantity: String(item.quantity),
          catalogObjectId: item.variationId,
          itemType: "ITEM",
        })),
      },
      checkoutOptions: {
        redirectUrl: confirmationUrl.toString(),
        askForShippingAddress: true,
      },
    });

    if (!linkResponse.result.paymentLink?.url) {
      throw new Error("Failed to create payment link");
    }

    return new Response(
      JSON.stringify({
        success: true,
        checkoutUrl: linkResponse.result.paymentLink.url,
        orderId,
      })
    );
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : "Checkout creation failed",
      }),
      { status: 500 }
    );
  }
};
