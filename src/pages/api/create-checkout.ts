// src/pages/api/create-checkout.ts
import type { APIRoute } from "astro";
import type { CartItem } from "@/lib/cart/types";
import { squareClient } from "@/lib/square/client";
import { checkBulkInventory } from "@/lib/square/inventory";
import { calculateShippingRate, PICKUP_LOCATION } from "@/lib/config/shipping";
import { siteConfig } from "@/lib/site-config";

/**
 * Normalize a phone number to E.164 format required by Square API.
 * Handles US formats: (555) 555-5555, 555-555-5555, 5555555555, +15555555555
 */
function normalizePhoneE164(phone: string): string {
  const cleaned = phone.trim();

  // Already in E.164 — strip any internal non-digit chars after the +
  if (cleaned.startsWith("+")) {
    return "+" + cleaned.slice(1).replace(/\D/g, "");
  }

  const digits = cleaned.replace(/\D/g, "");

  // US 10-digit number
  if (digits.length === 10) return `+1${digits}`;

  // US 11-digit number starting with country code 1
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  // Fallback: prefix with + and hope for the best
  return `+${digits}`;
}

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

    // Stable idempotency key — Square deduplicates retries with the same key.
    const idempotencyKey = checkoutKey ?? crypto.randomUUID();

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
            phoneNumber: normalizePhoneE164(shippingAddress.phone),
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
            phoneNumber: normalizePhoneE164(pickupContact.phone),
          },
          pickupAt: pickupTime.toISOString(),
          note: pickupNote,
        },
      });
    }

    // ── Create payment link (Square creates the order internally) ────────────
    // Square appends ?checkoutId=&orderId=&transactionId= to redirectUrl on
    // successful payment, so the confirmation page receives the real orderId
    // without us needing to pre-create a separate order.
    const confirmationUrl = new URL("/order-confirmation", request.url);
    confirmationUrl.searchParams.set("fulfillmentMethod", fulfillmentMethod);

    let linkResponse: Awaited<ReturnType<typeof squareClient.checkoutApi.createPaymentLink>>;
    try {
      linkResponse = await squareClient.checkoutApi.createPaymentLink({
        idempotencyKey,
        order: {
          locationId: import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
          lineItems,
          fulfillments: fulfillments.length > 0 ? fulfillments : undefined,
          pricingOptions: {
            autoApplyTaxes: true,
          },
        },
        checkoutOptions: {
          redirectUrl: confirmationUrl.toString(),
          askForShippingAddress: false,
          enableCoupon: true,
          merchantSupportEmail: siteConfig.contact.support,
        },
      });
    } catch (linkError) {
      const e = linkError as any;
      console.error("[create-checkout] checkoutApi.createPaymentLink FAILED");
      console.error("  statusCode:", e?.statusCode);
      console.error("  errors:", JSON.stringify(e?.errors ?? e?.message, null, 2));
      throw linkError;
    }

    if (!linkResponse.result.paymentLink?.url) {
      throw new Error("Failed to create payment link");
    }

    const orderId = linkResponse.result.paymentLink.orderId ?? "";
    console.log("[create-checkout] Payment link created:", linkResponse.result.paymentLink.url, "orderId:", orderId);

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

    // Log Square's detailed error array when available (ApiError from square/legacy)
    const apiErr = error as any;
    if (apiErr?.errors) {
      console.error(
        "Square API errors:",
        JSON.stringify(apiErr.errors, null, 2)
      );
    }
    if (apiErr?.statusCode) {
      console.error("Square status code:", apiErr.statusCode);
    }

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
