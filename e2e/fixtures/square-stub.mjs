// e2e/fixtures/square-stub.mjs
//
// Node preload (`node --import`) that fakes the Square Sandbox REST API at the
// global fetch layer, so the real PDP / QuickView can render and be driven in
// Playwright without credentials or network. Only requests to Square hosts are
// intercepted; everything else passes through. Real Square is never reached.
//
// Covers just the endpoints the product pages use:
//   GET  /v2/catalog/list?types=ITEM|CATEGORY   (flat categories, no hierarchy)
//   GET  /v2/catalog/object/{id}            (items and images)
//   POST /v2/catalog/batch-retrieve         (images)
//   POST /v2/inventory/counts/batch-retrieve
// Anything else is logged and answered with an empty object.
//
// Wire format is Square's REST JSON (snake_case); the SDK deserializes it.
import { CATEGORIES, PRODUCTS, imageUrl } from './square-catalog.mjs';

const LOCATION_ID = process.env.PUBLIC_SQUARE_LOCATION_ID || 'LOC1';
const money = (amount) => ({ amount, currency: 'USD' });

function toItem(p) {
  const item = {
    type: 'ITEM',
    id: p.id,
    version: 1,
    item_data: {
      name: p.name,
      description: p.description,
      image_ids: p.images,
      categories: p.categoryIds.map((id) => ({ id })),
      // The related-products scorer prefers the reporting category
      ...(p.categoryIds[0]
        ? { reporting_category: { id: p.categoryIds[0] } }
        : {}),
      variations: p.variations.map((v) => ({
        type: 'ITEM_VARIATION',
        id: v.id,
        version: 1,
        item_variation_data: {
          item_id: p.id,
          name: v.name,
          ordinal: v.ordinal,
          price_money: money(v.price),
          image_ids: [],
        },
      })),
    },
  };
  // Brand is a custom attribute on the item, not part of item_data
  if (p.brand) {
    item.custom_attribute_values = {
      brand: {
        name: 'Brand',
        key: 'brand',
        type: 'STRING',
        string_value: p.brand,
      },
    };
  }
  return item;
}

const ITEMS = new Map(PRODUCTS.map((p) => [p.id, toItem(p)]));
const STOCK = new Map(
  PRODUCTS.flatMap((p) => p.variations.map((v) => [v.id, v.stock]))
);
const IMAGE_IDS = new Set(PRODUCTS.flatMap((p) => p.images));

const image = (id) => ({
  type: 'IMAGE',
  id,
  image_data: { url: imageUrl(id) },
});
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const realFetch = globalThis.fetch;

globalThis.fetch = async (input, init = {}) => {
  // The SDK passes a Request object; method and body live on it, not on init.
  const isRequest =
    typeof input === 'object' &&
    input !== null &&
    typeof input.clone === 'function';
  const url = new URL(
    typeof input === 'string' ? input : isRequest ? input.url : String(input)
  );
  if (!/(^|\.)squareup(sandbox)?\.com$/.test(url.hostname)) {
    return realFetch(input, init);
  }

  const method = (
    init.method || (isRequest ? input.method : 'GET')
  ).toUpperCase();
  let body = {};
  if (method !== 'GET') {
    const raw = init.body ?? (isRequest ? await input.clone().text() : '');
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = {};
    }
  }
  const path = url.pathname;

  if (path === '/v2/catalog/list') {
    const types = url.searchParams.get('types');
    if (types === 'ITEM') return json({ objects: [...ITEMS.values()] });
    if (types === 'CATEGORY') {
      return json({
        objects: CATEGORIES.map((c) => ({
          type: 'CATEGORY',
          id: c.id,
          version: 1,
          category_data: { name: c.name, is_top_level: true },
        })),
      });
    }
    return json({});
  }

  if (path.startsWith('/v2/catalog/object/')) {
    const id = decodeURIComponent(path.split('/').pop());
    if (ITEMS.has(id)) return json({ object: ITEMS.get(id) });
    if (IMAGE_IDS.has(id)) return json({ object: image(id) });
    return json(
      { errors: [{ category: 'INVALID_REQUEST_ERROR', code: 'NOT_FOUND' }] },
      404
    );
  }

  if (path === '/v2/catalog/batch-retrieve') {
    const objects = (body.object_ids || [])
      .filter((id) => IMAGE_IDS.has(id))
      .map(image);
    return json({ objects });
  }

  if (path === '/v2/inventory/counts/batch-retrieve') {
    const counts = (body.catalog_object_ids || [])
      .filter((id) => (STOCK.get(id) ?? 0) > 0)
      .map((id) => ({
        catalog_object_id: id,
        catalog_object_type: 'ITEM_VARIATION',
        state: 'IN_STOCK',
        location_id: LOCATION_ID,
        quantity: String(STOCK.get(id)),
      }));
    return json({ counts });
  }

  console.error(`[square-stub] unhandled ${method} ${path}${url.search}`);
  return json({});
};
