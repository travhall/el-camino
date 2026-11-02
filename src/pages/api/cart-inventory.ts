// src/pages/api/cart-inventory.ts
import type { APIRoute } from 'astro';
import { checkBulkInventoryWithUnknown } from '@/lib/square/inventory';

const MAX_VARIATION_IDS = 50;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { variationIds } = (await request.json()) as {
      variationIds: string[];
    };

    if (!variationIds || !Array.isArray(variationIds)) {
      return new Response(
        JSON.stringify({ error: 'Invalid variationIds array required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (variationIds.length > MAX_VARIATION_IDS) {
      return new Response(
        JSON.stringify({ error: 'Too many variation IDs', success: false }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Use existing server-side inventory checking (no CORS issues). `inventory`
    // counts anything it couldn't determine as 0, which is right for validating
    // a cart. `unknown` names those IDs for callers that display stock, so they
    // can tell "couldn't check" from "sold out".
    const { inventory, unknown } =
      await checkBulkInventoryWithUnknown(variationIds);

    return new Response(
      JSON.stringify({
        success: true,
        inventory,
        unknown,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Cart inventory API error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch inventory data',
        success: false,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
