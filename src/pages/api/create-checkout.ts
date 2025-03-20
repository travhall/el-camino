// /api/create-checkout.ts
import type { APIRoute } from "astro";
import { Client, Environment } from "square";
import type { CartItem } from "@/lib/cart/types";
import { checkBulkInventory } from "@/lib/square/inventory";

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

    // Validate inventory before checkout
    const variationIds = items.map((item) => item.variationId);
    const inventoryLevels = await checkBulkInventory(variationIds);

    // Filter out out-of-stock items and adjust quantities
    const validItems: CartItem[] = [];
    const removedItems: string[] = [];
    const adjustedItems: { name: string; oldQty: number; newQty: number }[] =
      [];

    for (const item of items) {
      const availableQuantity = inventoryLevels[item.variationId] || 0;

      if (availableQuantity <= 0) {
        // Item is out of stock
        removedItems.push(item.title);
      } else if (item.quantity > availableQuantity) {
        // Adjust quantity to match available inventory
        adjustedItems.push({
          name: item.title,
          oldQty: item.quantity,
          newQty: availableQuantity,
        });

        validItems.push({
          ...item,
          quantity: availableQuantity,
        });
      } else {
        // Item is in stock and quantity is valid
        validItems.push(item);
      }
    }

    // Check if we have any valid items after inventory validation
    if (validItems.length === 0) {
      return new Response(
        JSON.stringify({
          error: "All items are out of stock",
          removedItems,
          adjustedItems,
        }),
        { status: 400 }
      );
    }

    // Generate message if cart was modified
    let stockMessage = "";
    if (removedItems.length > 0) {
      stockMessage += `Removed out-of-stock item${
        removedItems.length > 1 ? "s" : ""
      }: ${removedItems.join(", ")}. `;
    }
    if (adjustedItems.length > 0) {
      stockMessage += `Adjusted quantities for: ${adjustedItems
        .map((i) => `${i.name} (${i.oldQty} → ${i.newQty})`)
        .join(", ")}. `;
    }

    // Create order with valid items
    const orderResponse = await squareClient.ordersApi.createOrder({
      idempotencyKey: crypto.randomUUID(),
      order: {
        locationId: import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
        lineItems: validItems.map((item) => ({
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
        lineItems: validItems.map((item) => ({
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
        stockMessage: stockMessage || undefined,
        cartUpdated: removedItems.length > 0 || adjustedItems.length > 0,
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
