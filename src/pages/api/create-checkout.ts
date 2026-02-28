// src/pages/api/create-checkout.ts
import type { APIRoute } from "astro";
import type { CartItem } from "@/lib/cart/types";
import { squareClient } from "@/lib/square/client";
import { checkBulkInventory } from "@/lib/square/inventory";
import { calculateShippingRate, PICKUP_LOCATION } from "@/lib/config/shipping";
import { siteConfig } from "@/lib/site-config";

interface ShippingAddress {
  name: string;
  email: string;
  phone: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
}

interface PickupContact {
  name: string;
  email: string;
  phone: string;
  notes?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      items,
      fulfillmentMethod = "shipping",
      shippingAddress,
      pickupContact,
      checkoutKey,
    } = body as {
      items: CartItem[];
      fulfillmentMethod?: "shipping" | "pickup";
      shippingAddress?: ShippingAddress;
      pickupContact?: PickupContact;
      checkoutKey?: string;
    };

    // Derive stable idempotency keys from the client-supplied key so Square
    // deduplicates both calls if the client retries after a network error.
    const baseKey = checkoutKey ?? crypto.randomUUID();
    const orderIdempotencyKey = `${baseKey}-order`;
    const linkIdempotencyKey = `${baseKey}-link`;

    if (!items?.length) {
      return new Response(JSON.stringify({ error: "No items provided" }), {
        status: 400,
      });
    }

    // Validate fulfillment details
    if (fulfillmentMethod === "shipping" && !shippingAddress) {
      return new Response(
        JSON.stringify({ error: "Shipping address required" }),
        { status: 400 }
      );
    }

    if (fulfillmentMethod === "pickup" && !pickupContact) {
      return new Response(
        JSON.stringify({ error: "Pickup contact required" }),
        { status: 400 }
      );
    }

    // Validate inventory before checkout
    const variationIds = items.map((item) => item.variationId);
    const inventoryLevels = await checkBulkInventory(variationIds);

    // Filter out out-of-stock items and adjust quantities
    const validItems: CartItem[] = [];
    const removedItems: string[] = [];
    const adjustedItems: { name: string; oldQty: number; newQty: number }[] = [];

    for (const item of items) {
      const availableQuantity = inventoryLevels[item.variationId] || 0;

      if (availableQuantity <= 0) {
        removedItems.push(item.title);
      } else if (item.quantity > availableQuantity) {
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
        validItems.push(item);
      }
    }

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

    // Generate stock message
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

    // Calculate subtotal for shipping calculation using sale prices when available
    const subtotal = validItems.reduce((sum, item) => {
      const effectivePrice = (item as any).saleInfo?.salePrice ?? item.price;
      return sum + (effectivePrice * item.quantity);
    }, 0);

    // Calculate shipping cost (only for shipping orders)
    let shippingRate = 0;
    if (fulfillmentMethod === "shipping") {
      const rate = calculateShippingRate(subtotal);
      shippingRate = rate.rate;
    }

    // Build line items array
    const lineItems = validItems.map((item) => {
      const lineItem: any = {
        quantity: String(item.quantity),
        catalogObjectId: item.variationId,
        itemType: "ITEM" as const,
      };

      // Override price if item has sale pricing
      const saleInfo = (item as any).saleInfo;
      if (saleInfo?.salePrice) {
        lineItem.basePriceMoney = {
          amount: Math.round(saleInfo.salePrice * 100), // Convert to cents
          currency: "USD",
        };
      }

      return lineItem;
    });

    // Add shipping as a custom line item if shipping is selected
    if (fulfillmentMethod === "shipping" && shippingRate > 0) {
      lineItems.push({
        quantity: "1",
        itemType: "ITEM" as const,
        name: "Shipping",
        basePriceMoney: {
          amount: Math.round(shippingRate * 100), // Convert to cents
          currency: "USD",
        },
      } as any); // Type assertion needed for custom line item
    }

    // Build fulfillment details
    let fulfillments: any[] = [];

    if (fulfillmentMethod === "shipping" && shippingAddress) {
      // Calculate expected ship date (2 business days from now)
      const shipDate = new Date();
      shipDate.setDate(shipDate.getDate() + 2);
      
      fulfillments.push({
        type: "SHIPMENT",
        state: "PROPOSED",
        shipmentDetails: {
          recipient: {
            displayName: shippingAddress.name,
            emailAddress: shippingAddress.email,
            phoneNumber: shippingAddress.phone,
            address: {
              addressLine1: shippingAddress.street1,
              addressLine2: shippingAddress.street2 || undefined,
              locality: shippingAddress.city,
              administrativeDistrictLevel1: shippingAddress.state,
              postalCode: shippingAddress.zip,
              country: "US",
            },
          },
          expectedShippedAt: shipDate.toISOString(),
        },
      });
    } else if (fulfillmentMethod === "pickup" && pickupContact) {
      // Calculate pickup ready time (2-4 hours from now)
      const pickupTime = new Date();
      pickupTime.setHours(pickupTime.getHours() + 4);

      // Build pickup note with location details and customer instructions
      let pickupNote = `Pickup at ${PICKUP_LOCATION.name}. ${PICKUP_LOCATION.instructions}`;
      if (pickupContact.notes?.trim()) {
        pickupNote += `\n\nCustomer Notes: ${pickupContact.notes.trim()}`;
      }

      fulfillments.push({
        type: "PICKUP",
        state: "PROPOSED",
        pickupDetails: {
          recipient: {
            displayName: pickupContact.name,
            emailAddress: pickupContact.email,
            phoneNumber: pickupContact.phone,
          },
          pickupAt: pickupTime.toISOString(),
          note: pickupNote,
        },
      });
    }

    // Create order with fulfillment and tax auto-application
    const orderResponse = await squareClient.ordersApi.createOrder({
      idempotencyKey: orderIdempotencyKey,
      order: {
        locationId: import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
        lineItems,
        fulfillments: fulfillments.length > 0 ? fulfillments : undefined,
        pricingOptions: {
          autoApplyTaxes: true, // Enable automatic tax calculation
        },
      },
    });

    if (!orderResponse.result.order?.id) {
      throw new Error("Failed to create order");
    }

    const orderId = orderResponse.result.order.id;
    const confirmationUrl = new URL("/order-confirmation", request.url);
    confirmationUrl.searchParams.set("orderId", orderId);
    confirmationUrl.searchParams.set("fulfillmentMethod", fulfillmentMethod);

    // Create payment link referencing the existing order by object (legacy SDK requires full order object;
    // Square links to the existing order when order.id is present rather than creating a new one)
    const linkResponse = await squareClient.checkoutApi.createPaymentLink({
      idempotencyKey: linkIdempotencyKey,
      order: orderResponse.result.order,
      checkoutOptions: {
        redirectUrl: confirmationUrl.toString(),
        // We collect address/contact details ourselves — don't ask again at Square checkout
        askForShippingAddress: false,
        // Enable coupon support for Square marketing coupons
        enableCoupon: true,
        // Support email for customer inquiries
        merchantSupportEmail: siteConfig.contact.support,
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
        fulfillmentMethod,
        shippingCost: fulfillmentMethod === "shipping" ? shippingRate : 0,
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
