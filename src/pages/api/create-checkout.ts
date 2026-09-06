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
import { SquareError, type Fulfillment } from 'square-legacy';
import { storePendingOrder } from '@/lib/email/pendingOrders';
import { createRateLimiter, clientIp } from '@/lib/rateLimit';
import {
  buildShippingFulfillment,
  buildPickupFulfillment,
} from '@/lib/checkout/fulfillmentBuilders';
import { buildLineItems } from '@/lib/checkout/lineItems';
import { validateCheckoutBody } from '@/lib/checkout/validate';

// 10 checkout attempts per 5 min per IP — generous for real users, blocks scripts
const checkoutLimiter = createRateLimiter({ windowMs: 5 * 60_000, max: 10 });

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
    const validation = validateCheckoutBody(body);
    if (!validation.ok) {
      console.error(
        '[create-checkout] Invalid request body:',
        validation.errors.join('; ')
      );
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const {
      items,
      fulfillmentMethod,
      shippingAddress,
      pickupContact,
      checkoutKey,
    } = validation.value;

    // Stable idempotency key — Square deduplicates retries with the same key.
    const idempotencyKey = checkoutKey ?? crypto.randomUUID();

    // Validate inventory before checkout
    // Skip gift cards — they have no tracked inventory and are always available
    const nonGiftCardItems = items.filter((item) => !item.isGiftCard);
    const giftCardItems = items.filter((item) => item.isGiftCard);

    const variationIds = nonGiftCardItems.map((item) => item.variationId);

    // Fetch inventory and pricing in parallel — they are independent.
    // pricingAll uses the full variationIds list (before inventory filtering);
    // OOS pricing is fetched but later discarded — small wasted work traded for
    // lower latency (saves ~150–500 ms per checkout vs. sequential awaits).
    const [inventoryLevels, pricingAll] = await Promise.all([
      variationIds.length > 0
        ? checkBulkInventory(variationIds)
        : Promise.resolve({} as Record<string, number>),
      variationIds.length > 0
        ? getAuthoritativePricing(variationIds)
        : Promise.resolve({} as Record<string, AuthoritativePrice>),
    ]);

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

    // Calculate subtotal for shipping using server-derived effective prices,
    // falling back to the catalog regular price (item.price) when no trusted
    // entry exists (e.g. variable-price gift cards).
    const subtotal = validItems.reduce((sum, item) => {
      const effectivePrice =
        pricing[item.variationId]?.effectivePrice ?? item.price;
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
