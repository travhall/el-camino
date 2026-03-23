// src/pages/api/webhooks/square.ts
//
// Handles Square webhook events for real-time cache invalidation.
//
// Supported events:
//   inventory.count.updated — fires when stock changes (purchase, restock, adjustment)
//   catalog.version.updated — fires when catalog items are created, edited, or deleted
//
// Setup (one-time, in Square Developer Dashboard):
//   1. Go to Applications → your app → Webhooks → Add subscription
//   2. Notification URL: https://your-domain.com/api/webhooks/square
//   3. Events: inventory.count.updated, catalog.version.updated
//   4. Copy the "Signature key" into the SQUARE_WEBHOOK_SIGNATURE_KEY env var
//
// Local dev note: Square cannot reach localhost directly. Use a tunnel
// (ngrok / Cloudflare Tunnel) to test locally, or use Square's
// "Send test event" feature in the Developer Dashboard against production.

import type { APIRoute } from "astro";
import { WebhooksHelper } from "square";
import {
  inventoryCache,
  productCache,
  categoryCache,
  navigationCache,
  slugCache,
  filterCache,
} from "@/lib/cache/blobCache";
import { batchInventoryService } from "@/lib/square/batchInventory";

export const POST: APIRoute = async ({ request }) => {
  // Read raw body as text — must not be pre-parsed; signature verification
  // requires the exact bytes Square sent.
  const rawBody = await request.text();
  const signatureHeader =
    request.headers.get("x-square-hmacsha256-signature") ?? "";
  const signatureKey = import.meta.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

  if (!signatureKey) {
    console.error(
      "[Webhook/Square] SQUARE_WEBHOOK_SIGNATURE_KEY env var is not set"
    );
    // Return 200 so Square doesn't retry — this is a config error, not a
    // transient failure.
    return new Response(JSON.stringify({ received: false, reason: "not configured" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Square sends the full notification URL as the base for the HMAC.
  // Use request.url which Astro populates from the incoming request.
  const isValid = await WebhooksHelper.verifySignature({
    requestBody: rawBody,
    signatureHeader,
    signatureKey,
    notificationUrl: request.url,
  });

  if (!isValid) {
    console.warn("[Webhook/Square] Signature verification failed — rejecting");
    return new Response("Unauthorized", { status: 403 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType = event?.type as string | undefined;
  if (!eventType) {
    return new Response("Missing event type", { status: 400 });
  }

  console.log(`[Webhook/Square] Processing event: ${eventType}`);

  try {
    switch (eventType) {
      case "inventory.count.updated": {
        // Extract variation IDs from the counts array.
        // Square only includes counts for ITEM_VARIATION objects; we filter
        // defensively in case the payload ever includes other object types.
        const counts: any[] =
          event.data?.object?.inventory_counts ?? [];

        const variationIds = counts
          .filter((c) => c.catalog_object_type === "ITEM_VARIATION")
          .map((c) => c.catalog_object_id as string)
          .filter(Boolean);

        if (variationIds.length > 0) {
          await Promise.allSettled(
            variationIds.map((id) => inventoryCache.delete(id))
          );
          // BatchInventoryService has its own separate in-memory Map — must
          // be cleared independently of BlobCache.
          batchInventoryService.clearCache();
          console.log(
            `[Webhook/Square] Inventory cache busted for ${variationIds.length} variation(s):`,
            variationIds
          );
        }
        break;
      }

      case "catalog.version.updated": {
        // Any catalog change (product edit, delete, price change, new item)
        // may affect product data, navigation, categories, and slugs.
        const objectIds: string[] =
          event.data?.object?.catalog_version?.updated_object_ids ?? [];

        // Clear per-object caches for affected IDs
        if (objectIds.length > 0) {
          await Promise.allSettled([
            ...objectIds.map((id) => productCache.delete(id)),
            ...objectIds.map((id) => inventoryCache.delete(id)),
          ]);
          batchInventoryService.clearCache();
        }

        // Clear structural caches — deletion/rename/category reassignment
        // can affect navigation, category listings, and slug resolution.
        await Promise.allSettled([
          categoryCache.clear(),
          navigationCache.clear(),
          slugCache.clear(),
          filterCache.clear(),
        ]);

        console.log(
          `[Webhook/Square] Catalog caches busted for ${objectIds.length} object(s):`,
          objectIds
        );
        break;
      }

      default:
        // Acknowledge and ignore — Square may send event types we don't
        // subscribe to if the subscription is broadened later.
        console.log(`[Webhook/Square] Unhandled event type: ${eventType}`);
    }
  } catch (err) {
    console.error(
      `[Webhook/Square] Error handling event "${eventType}":`,
      err
    );
    // Still return 200: Square treats non-2xx as a delivery failure and
    // retries with exponential backoff, which would flood the endpoint.
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
