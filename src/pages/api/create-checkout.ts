// src/pages/api/create-checkout.ts
import type { APIRoute } from "astro";
import type { CartItem } from "@/lib/cart/types";
import { squareClient } from "@/lib/square/client";
import { checkoutRetryClient } from "@/lib/square/apiRetry";
import { checkBulkInventory } from "@/lib/square/inventory";
import { getAuthoritativePricing } from "@/lib/square/pricing";
import { calculateShippingRate, getPickupLocation } from "@/lib/config/shipping";
import { siteConfig } from "@/lib/site-config";
import { inventoryCache, productCache } from "@/lib/cache/blobCache";
import { storePendingOrder } from "@/lib/email/pendingOrders";
import { getShopHoursRaw } from "@/lib/shopHours";
import type { ShopHoursEntry } from "@/lib/shopHours";
import { createRateLimiter, clientIp } from "@/lib/rateLimit";

// 10 checkout attempts per 5 min per IP — generous for real users, blocks scripts
const checkoutLimiter = createRateLimiter({ windowMs: 5 * 60_000, max: 10 });

// Store timezone for business hours calculations
const STORE_TIMEZONE = "America/Chicago";

/**
 * Return open/close hours (as 0–23 integers) for a JS day-of-week (0=Sun…6=Sat)
 * from the live admin-managed hours, or null if the store is closed that day.
 * DAYS_OF_WEEK in shopHours is Mon(0)…Sun(6), so we convert with (jsDay + 6) % 7.
 */
function storeHoursForDay(
  jsDay: number,
  hoursData: ShopHoursEntry[],
): { open: number; close: number } | null {
  const idx = (jsDay + 6) % 7;
  const entry = hoursData[idx];
  if (!entry?.isOpen || !entry.open || !entry.close) return null;
  const [oh, om] = entry.open.split(":").map(Number);
  const [ch, cm] = entry.close.split(":").map(Number);
  // Convert to fractional hours for simple comparison
  return { open: oh + om / 60, close: ch + cm / 60 };
}

/**
 * Return the day-of-week and hour-of-day for a UTC Date in the store timezone.
 */
function storeTimeOf(date: Date): { jsDay: number; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIMEZONE,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hr = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return { jsDay: dayMap[wd] ?? 0, hour: hr };
}

/**
 * Round a Date up to the next 15-minute boundary.
 * e.g. 2:07 PM → 2:15 PM, 2:00 PM → 2:00 PM (already on boundary)
 */
function roundUpTo15(date: Date): Date {
  const ms = date.getTime();
  const interval = 15 * 60 * 1000;
  const remainder = ms % interval;
  return remainder === 0 ? new Date(ms) : new Date(ms + (interval - remainder));
}

/**
 * Return the earliest time that is:
 *   (a) at least 2 hours from `from`, rounded up to the next 15-minute mark, AND
 *   (b) during store business hours (from the live admin-managed schedule).
 *
 * When ordering during store hours, the window starts from the order time.
 * When ordering after close (or before open), the 2-hour window starts from
 * the next time the store opens — so open+2h rather than open.
 */
async function nextPickupTime(from: Date): Promise<Date> {
  const hoursData = await getShopHoursRaw();
  const initialCandidate = roundUpTo15(
    new Date(from.getTime() + 2 * 60 * 60 * 1000),
  );

  // Fast path: order+2h already falls within business hours
  const { jsDay: iDay, hour: iHour } = storeTimeOf(initialCandidate);
  const iHours = storeHoursForDay(iDay, hoursData);
  if (iHours && iHour >= iHours.open && iHour < iHours.close) {
    return initialCandidate;
  }

  // After-hours path: find the next time the store opens, then give a full
  // 2-hour window from that open time (e.g. opens 11 AM → ready at 1 PM).
  let candidate = initialCandidate;
  for (let i = 0; i < 7 * 24 * 4; i++) {
    const { jsDay, hour } = storeTimeOf(candidate);
    const hours = storeHoursForDay(jsDay, hoursData);
    if (hours && hour >= hours.open && hour < hours.close) {
      return roundUpTo15(new Date(candidate.getTime() + 2 * 60 * 60 * 1000));
    }
    candidate = new Date(candidate.getTime() + 15 * 60 * 1000);
  }

  return candidate; // fallback — should never reach here
}

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
  instructions?: string;
}

interface PickupContact {
  name: string;
  email: string;
  phone: string;
  notes?: string;
}

export const POST: APIRoute = async ({ request }) => {
  if (checkoutLimiter.check(clientIp(request))) {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

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
        JSON.stringify({ error: "Pick up contact required" }),
        { status: 400 }
      );
    }

    // Validate inventory before checkout
    // Skip gift cards — they have no tracked inventory and are always available
    const nonGiftCardItems = items.filter((item) => !item.isGiftCard);
    const giftCardItems = items.filter((item) => item.isGiftCard);

    const variationIds = nonGiftCardItems.map((item) => item.variationId);
    const inventoryLevels = variationIds.length > 0
      ? await checkBulkInventory(variationIds)
      : {};

    // Filter out out-of-stock items and adjust quantities
    const validItems: CartItem[] = [...giftCardItems]; // gift cards always valid
    const removedItems: string[] = [];
    const adjustedItems: { name: string; oldQty: number; newQty: number }[] = [];

    for (const item of nonGiftCardItems) {
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

    // ── Server-authoritative pricing ──────────────────────────────────────────
    // Re-derive every price from the Square catalog. The client cart (and its
    // saleInfo) is attacker-controlled via localStorage, so it is NEVER trusted
    // for pricing — only for choosing WHICH variation and quantity to buy.
    const pricedVariationIds = validItems
      .filter((item) => !item.isGiftCard)
      .map((item) => item.variationId);
    const pricing = await getAuthoritativePricing(pricedVariationIds);

    // Calculate subtotal for shipping using server-derived effective prices,
    // falling back to the catalog regular price (item.price) when no trusted
    // entry exists (e.g. variable-price gift cards).
    const subtotal = validItems.reduce((sum, item) => {
      const effectivePrice = pricing[item.variationId]?.effectivePrice ?? item.price;
      return sum + effectivePrice * item.quantity;
    }, 0);

    // Calculate shipping cost (only for shipping orders)
    let shippingRate = 0;
    if (fulfillmentMethod === "shipping") {
      shippingRate = calculateShippingRate(subtotal);
    }

    // Build line items array
    const lineItems = validItems.map((item) => {
      const lineItem: any = {
        quantity: String(item.quantity),
        catalogObjectId: item.variationId,
        itemType: "ITEM" as const,
      };

      // Apply a sale price ONLY when the Square catalog confirms an active sale
      // for this variation. Without an override Square charges the catalog's
      // regular price, so a missing or failed price lookup safely falls back to
      // full price rather than an attacker-supplied discount.
      const salePrice = pricing[item.variationId]?.salePrice;
      if (salePrice) {
        lineItem.basePriceMoney = {
          amount: BigInt(Math.round(salePrice * 100)), // Convert to cents
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
          amount: BigInt(Math.round(shippingRate * 100)), // Convert to cents
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
      
      // Build shipment note — stores delivery instructions so the admin page can surface them
      const shipmentNote = shippingAddress.instructions?.trim()
        ? `Delivery Instructions: ${shippingAddress.instructions.trim()}`
        : undefined;

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
          shippingNote: shipmentNote,
        },
      });
    } else if (fulfillmentMethod === "pickup" && pickupContact) {
      // Fetch live pickup location and calculate ready time concurrently
      const [pickupLocation, pickupTime] = await Promise.all([
        getPickupLocation(),
        nextPickupTime(new Date()),
      ]);

      // Build pickup note with location details and customer instructions
      let pickupNote = `Pick up at ${pickupLocation.name}. ${pickupLocation.instructions}`;
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

    // ── Create payment link ───────────────────────────────────────────────────
    // Square creates the order internally and returns its orderId in the
    // payment link response. We pass that orderId back to the client so it
    // can be stored in sessionStorage before the browser is handed off to
    // Square's hosted checkout page — this is our source of truth for the
    // orderId on the confirmation page, since Square's legacy checkout API
    // does not reliably append orderId to the redirect URL.
    const confirmationUrl = new URL("/order-confirmation", request.url);
    confirmationUrl.searchParams.set("fulfillmentMethod", fulfillmentMethod);

    let linkResponse: Awaited<ReturnType<typeof squareClient.checkout.paymentLinks.create>>;
    try {
      linkResponse = await checkoutRetryClient.executeWithRetry(
        () =>
          squareClient.checkout.paymentLinks.create({
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
              enableLoyalty: true,
              merchantSupportEmail: siteConfig.contact.support,
              acceptedPaymentMethods: {
                applePay: true,
                googlePay: true,
                cashAppPay: true,
                afterpayClearpay: true,
              },
              customFields: [
                { title: "Order Notes" },
              ],
            },
          }),
        "create-checkout:paymentLinks.create",
        { maxRetries: 2, baseDelay: 500 }
      );
    } catch (linkError) {
      const e = linkError as any;
      console.error("[create-checkout] checkout.paymentLinks.create FAILED");
      console.error("  statusCode:", e?.statusCode);
      console.error("  errors:", JSON.stringify(e?.errors ?? e?.message, null, 2));
      throw linkError;
    }

    if (!linkResponse.paymentLink?.url) {
      throw new Error("Failed to create payment link");
    }

    // v44 SDK: orderId lives on paymentLink.orderId; fall back to the first
    // order in relatedResources (which v44 always populates) if orderId is absent.
    const orderId =
      linkResponse.paymentLink.orderId ??
      (linkResponse as any).relatedResources?.orders?.[0]?.id ??
      "";

    console.log(`[create-checkout] orderId=${orderId || "(empty)"}, url=${linkResponse.paymentLink.url?.slice(0, 60)}`);

    // Store contact info keyed by orderId so the webhook can send a confirmation email.
    // Must be awaited — Netlify functions stop executing once the response is sent,
    // so a fire-and-forget blob write gets abandoned before it can persist.
    // Wrapped in try/catch so a blob failure never blocks the checkout redirect.
    if (orderId) {
      const contactEmail =
        fulfillmentMethod === "shipping"
          ? shippingAddress?.email
          : pickupContact?.email;
      const contactName =
        fulfillmentMethod === "shipping"
          ? shippingAddress?.name
          : pickupContact?.name;

      if (contactEmail) {
        try {
          await storePendingOrder(orderId, {
            email: contactEmail,
            name: contactName ?? "Customer",
            fulfillmentMethod,
          });
        } catch (err) {
          console.error("[create-checkout] Failed to store pending order:", err);
        }
      }
    }

    // Bust the inventory caches for every variation in this order so the
    // product grid, PDP, and Quick View show accurate stock immediately after
    // purchase rather than serving stale cached values.
    //
    // Two caches must be cleared:
    // 1. inventoryCache (BlobCache) — backs both checkItemInventory (PDP/QuickView)
    //    AND batchInventoryService (ProductGrid), which read/write the same store.
    // 2. productCache "all-catalog-items-v3" — used by fetchProductsByCategory / category pages
    const purchasedVariationIds = validItems.map((item) => item.variationId);
    await Promise.allSettled(
      purchasedVariationIds.map((id) => inventoryCache.delete(id))
    );
    await productCache.delete("all-catalog-items-v3");

    // Set a server-readable cookie with the orderId so the confirmation page can
    // retrieve it without relying on Square appending it to the redirect URL
    // (Square's legacy checkout API does not reliably do so).
    // SameSite=Lax allows the cookie to be sent on the top-level cross-site
    // navigation from Square back to our domain.
    const cookie = orderId
      ? `square-pending-orderId=${orderId}; Path=/; Max-Age=3600; SameSite=Lax; HttpOnly${import.meta.env.PROD ? "; Secure" : ""}`
      : "";

    return new Response(
      JSON.stringify({
        success: true,
        checkoutUrl: linkResponse.paymentLink?.url,
        orderId,
        fulfillmentMethod,
        shippingCost: fulfillmentMethod === "shipping" ? shippingRate : 0,
        stockMessage: stockMessage || undefined,
        cartUpdated: removedItems.length > 0 || adjustedItems.length > 0,
      }),
      cookie ? { headers: { "Set-Cookie": cookie } } : undefined
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
        error: "Checkout creation failed. Please try again.",
      }),
      { status: 500 }
    );
  }
};
