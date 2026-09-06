// src/pages/api/create-checkout.ts
import type { APIRoute } from 'astro';
import type { CartItem } from '@/lib/cart/types';
import { squareClient } from '@/lib/square/client';
import { checkoutRetryClient } from '@/lib/square/apiRetry';
import { checkBulkInventory } from '@/lib/square/inventory';
import {
  getAuthoritativePricing,
  type AuthoritativePrice,
} from '@/lib/square/pricing';
import { calculateShippingRate } from '@/lib/config/shipping';
import { siteConfig } from '@/lib/site-config';
import { inventoryCache } from '@/lib/cache/blobCache';
import { extractIsGiftCard } from '@/lib/square/catalogUtils';
import {
  SquareError,
  type Fulfillment,
  type CatalogObject,
} from 'square-legacy';
import { storePendingOrder } from '@/lib/email/pendingOrders';
import { createRateLimiter, clientIp } from '@/lib/rateLimit';
import {
  buildShippingFulfillment,
  buildPickupFulfillment,
} from '@/lib/checkout/fulfillmentBuilders';
import { buildLineItems } from '@/lib/checkout/lineItems';
import type { ShippingAddress, PickupContact } from '@/lib/checkout/types';

// 10 checkout attempts per 5 min per IP — generous for real users, blocks scripts
const checkoutLimiter = createRateLimiter({ windowMs: 5 * 60_000, max: 10 });

// ── Server-authoritative gift-card detection ────────────────────────────────
// The client's `isGiftCard` flag is attacker-controlled (it comes straight
// from the cart in localStorage) and must never decide whether inventory is
// checked or whether the client-supplied price is trusted. The Square
// catalog's own item-level `isGiftCard` custom attribute (read via
// `extractIsGiftCard`) is the only source of truth. Batch-fetching each
// variation WITH its related objects gives us the parent ITEM for each
// variation (Square returns a variation's parent item in `relatedObjects`
// when `includeRelatedObjects` is set), so the attribute can be read without
// trusting anything the client sent besides which variation IDs to look up.
async function getServerGiftCardVariationIds(
  variationIds: string[]
): Promise<Set<string>> {
  const giftCardIds = new Set<string>();
  try {
    const response = await squareClient.catalog.batchGet({
      objectIds: variationIds,
      includeRelatedObjects: true,
    });

    const itemsById = new Map(
      (response.relatedObjects ?? [])
        .filter((obj): obj is CatalogObject.Item => obj.type === 'ITEM')
        .map((item) => [item.id, item] as const)
    );

    for (const obj of response.objects ?? []) {
      if (obj.type !== 'ITEM_VARIATION') continue;
      const parentItemId = obj.itemVariationData?.itemId;
      const parentItem = parentItemId ? itemsById.get(parentItemId) : undefined;
      if (extractIsGiftCard(parentItem?.customAttributeValues)) {
        giftCardIds.add(obj.id);
      }
    }
  } catch (error) {
    // Fail safe toward the merchant: on any catalog failure, trust nothing as
    // a gift card. Every item then goes through the normal inventory path
    // like any other item — never the client's forged flag.
    console.error(
      '[create-checkout] Failed to derive gift-card status from catalog:',
      error
    );
  }
  return giftCardIds;
}

export const POST: APIRoute = async ({ request }) => {
  if (checkoutLimiter.check(clientIp(request))) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again shortly.' }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const body = await request.json();
    const {
      items,
      fulfillmentMethod = 'shipping',
      shippingAddress,
      pickupContact,
      checkoutKey,
    } = body as {
      items: CartItem[];
      fulfillmentMethod?: 'shipping' | 'pickup';
      shippingAddress?: ShippingAddress;
      pickupContact?: PickupContact;
      checkoutKey?: string;
    };

    // Stable idempotency key — Square deduplicates retries with the same key.
    const idempotencyKey = checkoutKey ?? crypto.randomUUID();

    if (!items?.length) {
      return new Response(JSON.stringify({ error: 'No items provided' }), {
        status: 400,
      });
    }

    // Validate fulfillment details
    if (fulfillmentMethod === 'shipping' && !shippingAddress) {
      return new Response(
        JSON.stringify({ error: 'Shipping address required' }),
        { status: 400 }
      );
    }

    if (fulfillmentMethod === 'pickup' && !pickupContact) {
      return new Response(
        JSON.stringify({ error: 'Pick up contact required' }),
        { status: 400 }
      );
    }

    // Validate inventory before checkout.
    // Gift-card status is derived from the catalog, never trusted from the
    // client's `isGiftCard` flag (see getServerGiftCardVariationIds above).
    const allVariationIds = items.map((item) => item.variationId);

    // Fetch pricing and gift-card status in parallel — both are independent
    // catalog lookups over the full item list.
    // pricingAll uses the full variationIds list (before inventory filtering);
    // OOS pricing is fetched but later discarded — small wasted work traded for
    // lower latency (saves ~150–500 ms per checkout vs. sequential awaits).
    const [pricingAll, giftCardVariationIds] = await Promise.all([
      allVariationIds.length > 0
        ? getAuthoritativePricing(allVariationIds)
        : Promise.resolve({} as Record<string, AuthoritativePrice>),
      allVariationIds.length > 0
        ? getServerGiftCardVariationIds(allVariationIds)
        : Promise.resolve(new Set<string>()),
    ]);

    // Skip gift cards — they have no tracked inventory and are always
    // available. Membership here is catalog-confirmed (giftCardVariationIds),
    // never the client's flag.
    const nonGiftCardItems = items.filter(
      (item) => !giftCardVariationIds.has(item.variationId)
    );
    const giftCardItems = items.filter((item) =>
      giftCardVariationIds.has(item.variationId)
    );

    const variationIds = nonGiftCardItems.map((item) => item.variationId);

    // Inventory is checked only for catalog-confirmed non-gift-card items.
    // Gift cards have no tracked inventory — checkBulkInventory would report
    // 0 for them and wrongly flag a real gift card as out of stock.
    const inventoryLevels =
      variationIds.length > 0
        ? await checkBulkInventory(variationIds)
        : ({} as Record<string, number>);

    // Filter out out-of-stock items and adjust quantities
    const validItems: CartItem[] = [...giftCardItems]; // gift cards always valid
    const removedItems: string[] = [];
    const adjustedItems: { name: string; oldQty: number; newQty: number }[] =
      [];

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
          error: 'All items are out of stock',
          removedItems,
          adjustedItems,
        }),
        { status: 400 }
      );
    }

    // Generate stock message
    let stockMessage = '';
    if (removedItems.length > 0) {
      stockMessage += `Removed out-of-stock item${
        removedItems.length > 1 ? 's' : ''
      }: ${removedItems.join(', ')}. `;
    }
    if (adjustedItems.length > 0) {
      stockMessage += `Adjusted quantities for: ${adjustedItems
        .map((i) => `${i.name} (${i.oldQty} → ${i.newQty})`)
        .join(', ')}. `;
    }

    // ── Server-authoritative pricing ──────────────────────────────────────────
    // Re-derive every price from the Square catalog. The client cart (and its
    // saleInfo) is attacker-controlled via localStorage, so it is NEVER trusted
    // for pricing — only for choosing WHICH variation and quantity to buy.
    // pricing was fetched above in parallel with inventory; alias for clarity.
    const pricing = pricingAll;

    // Calculate subtotal for shipping using server-derived effective prices.
    // A missing catalog entry (e.g. a variable-price gift card) contributes 0,
    // NEVER the client-supplied item.price — a missing price can only reduce
    // the subtotal, so the worst case is charging shipping the customer might
    // have earned free, never an attacker-forced free-shipping threshold. Do
    // not restore the `?? item.price` fallback.
    const subtotal = validItems.reduce((sum, item) => {
      const entry = pricing[item.variationId];
      if (!entry) {
        console.warn(
          `[create-checkout] No authoritative price for variation ${item.variationId} (${item.title}); contributing 0 to subtotal.`
        );
      }
      const effectivePrice = entry?.effectivePrice ?? 0;
      return sum + effectivePrice * item.quantity;
    }, 0);

    // Calculate shipping cost (only for shipping orders)
    let shippingRate = 0;
    if (fulfillmentMethod === 'shipping') {
      shippingRate = calculateShippingRate(subtotal);
    }

    // Build line items array
    const lineItems = buildLineItems(
      validItems,
      pricing,
      shippingRate,
      fulfillmentMethod
    );

    // Build fulfillment details
    let fulfillments: Fulfillment[] = [];

    if (fulfillmentMethod === 'shipping' && shippingAddress) {
      fulfillments.push(buildShippingFulfillment(shippingAddress));
    } else if (fulfillmentMethod === 'pickup' && pickupContact) {
      fulfillments.push(await buildPickupFulfillment(pickupContact));
    }

    // ── Create payment link ───────────────────────────────────────────────────
    // Square creates the order internally and returns its orderId in the
    // payment link response. We pass that orderId back to the client so it
    // can be stored in sessionStorage before the browser is handed off to
    // Square's hosted checkout page — this is our source of truth for the
    // orderId on the confirmation page, since Square's legacy checkout API
    // does not reliably append orderId to the redirect URL.
    const confirmationUrl = new URL('/order-confirmation', request.url);
    confirmationUrl.searchParams.set('fulfillmentMethod', fulfillmentMethod);

    let linkResponse: Awaited<
      ReturnType<typeof squareClient.checkout.paymentLinks.create>
    >;
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
              customFields: [{ title: 'Order Notes' }],
            },
          }),
        'create-checkout:paymentLinks.create',
        { maxRetries: 2, baseDelay: 500 }
      );
    } catch (linkError) {
      const e = linkError as SquareError;
      console.error('[create-checkout] checkout.paymentLinks.create FAILED');
      console.error('  statusCode:', e?.statusCode);
      console.error(
        '  errors:',
        JSON.stringify(e?.errors ?? e?.message, null, 2)
      );
      throw linkError;
    }

    if (!linkResponse.paymentLink?.url) {
      throw new Error('Failed to create payment link');
    }

    // v44 SDK: orderId lives on paymentLink.orderId; fall back to the first
    // order in relatedResources (which v44 always populates) if orderId is absent.
    const orderId =
      linkResponse.paymentLink.orderId ??
      linkResponse.relatedResources?.orders?.[0]?.id ??
      '';

    console.info(
      `[create-checkout] orderId=${orderId || '(empty)'}, url=${linkResponse.paymentLink.url?.slice(0, 60)}`
    );

    // Store contact info keyed by orderId so the webhook can send a confirmation email.
    // Must be awaited — Netlify functions stop executing once the response is sent,
    // so a fire-and-forget blob write gets abandoned before it can persist.
    // Wrapped in try/catch so a blob failure never blocks the checkout redirect.
    if (orderId) {
      const contactEmail =
        fulfillmentMethod === 'shipping'
          ? shippingAddress?.email
          : pickupContact?.email;
      const contactName =
        fulfillmentMethod === 'shipping'
          ? shippingAddress?.name
          : pickupContact?.name;

      if (contactEmail) {
        try {
          await storePendingOrder(orderId, {
            email: contactEmail,
            name: contactName ?? 'Customer',
            fulfillmentMethod,
          });
        } catch (err) {
          console.error(
            '[create-checkout] Failed to store pending order:',
            err
          );
        }
      }
    }

    // Bust the inventory caches for every variation in this order so the
    // product grid, PDP, and Quick View show accurate stock immediately after
    // purchase rather than serving stale cached values.
    const purchasedVariationIds = validItems.map((item) => item.variationId);
    await Promise.allSettled(
      purchasedVariationIds.map((id) => inventoryCache.delete(id))
    );

    // Set a server-readable cookie with the orderId so the confirmation page can
    // retrieve it without relying on Square appending it to the redirect URL
    // (Square's legacy checkout API does not reliably do so).
    // SameSite=Lax allows the cookie to be sent on the top-level cross-site
    // navigation from Square back to our domain.
    const cookie = orderId
      ? `square-pending-orderId=${encodeURIComponent(orderId)}; Path=/; Max-Age=3600; SameSite=Lax; HttpOnly${import.meta.env.PROD ? '; Secure' : ''}`
      : '';

    return new Response(
      JSON.stringify({
        success: true,
        checkoutUrl: linkResponse.paymentLink?.url,
        orderId,
        fulfillmentMethod,
        shippingCost: fulfillmentMethod === 'shipping' ? shippingRate : 0,
        stockMessage: stockMessage || undefined,
        cartUpdated: removedItems.length > 0 || adjustedItems.length > 0,
      }),
      cookie ? { headers: { 'Set-Cookie': cookie } } : undefined
    );
  } catch (error) {
    console.error('Checkout error:', error);

    // Log Square's detailed error array when available (ApiError from square/legacy)
    const apiErr = error as SquareError;
    if (apiErr?.errors) {
      console.error(
        'Square API errors:',
        JSON.stringify(apiErr.errors, null, 2)
      );
    }
    if (apiErr?.statusCode) {
      console.error('Square status code:', apiErr.statusCode);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Checkout creation failed. Please try again.',
      }),
      { status: 500 }
    );
  }
};
