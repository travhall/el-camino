// e2e/fixtures/square-catalog.mjs
//
// Catalog data for the Square stub (see square-stub.mjs). Plain data so both
// the stub (a Node preload) and the specs can import it.
//
// Each product exists to exercise one behavior the PDP/QuickView got wrong:
//
//  TEE    Sparse color x size matrix with item-level color images, in the
//         "Test Goods" category.
//         Black/S in stock, Black/M SOLD OUT, White/S in stock, White/L in
//         stock. Black/L and White/M do not exist.
//  DECK   No color attribute; three multi-angle images shared by every size.
//  PROMO  Default variation (Black/S) is sold out, so the page promotes the
//         first in-stock one (White/S), which is not the first color.
//         Black/M, White/L... do not exist; sizes are S and M.

const imageUrl = (name) =>
  `https://items-images-sandbox.s3.amazonaws.com/${name}.jpg`;

// A category for product pages to hang their breadcrumb/back link on. The name
// avoids words ("tees", "tops", "apparel", ...) that switch on the size guide.
export const CATEGORY = { id: 'CAT_TEST_GOODS', name: 'Test Goods' };

// Categories for the related-products cluster. Their slugs (decks, trucks,
// wheels) are the ones the related-products scorer treats as complementary.
export const DECKS = { id: 'CAT_DECKS', name: 'Decks' };
export const TRUCKS = { id: 'CAT_TRUCKS', name: 'Trucks' };
export const WHEELS = { id: 'CAT_WHEELS', name: 'Wheels' };
export const CATEGORIES = [CATEGORY, DECKS, TRUCKS, WHEELS];

function product({
  id,
  name,
  description,
  images,
  variations,
  categoryIds,
  brand,
}) {
  return {
    id,
    name,
    description,
    images,
    brand,
    categoryIds: categoryIds ?? [],
    variations: variations.map((v, i) => ({ ...v, ordinal: i + 1 })),
  };
}

export const TEE = product({
  id: 'TESTTEE0000000000000000AA',
  name: 'Test Tee',
  description: 'Sparse color/size matrix with item-level color images.',
  images: ['IMG_TEE_BLACK', 'IMG_TEE_WHITE'],
  categoryIds: [CATEGORY.id],
  variations: [
    { id: 'VAR_TEE_BLACK_S', name: 'Black, S', price: 2500, stock: 5 },
    { id: 'VAR_TEE_BLACK_M', name: 'Black, M', price: 2500, stock: 0 },
    { id: 'VAR_TEE_WHITE_S', name: 'White, S', price: 2500, stock: 3 },
    { id: 'VAR_TEE_WHITE_L', name: 'White, L', price: 2500, stock: 4 },
  ],
});

export const DECK = product({
  id: 'TESTDECK000000000000000BB',
  name: 'Test Deck',
  description: 'Multi-angle images shared by every size.',
  images: ['IMG_DECK_1', 'IMG_DECK_2', 'IMG_DECK_3'],
  variations: [
    { id: 'VAR_DECK_8', name: '8.0', price: 6000, stock: 4 },
    { id: 'VAR_DECK_825', name: '8.25', price: 6000, stock: 4 },
  ],
});

export const PROMO = product({
  id: 'TESTPROMO000000000000000CC',
  name: 'Promo Tee',
  description: 'Default variation is sold out; a different color is promoted.',
  images: ['IMG_PROMO_BLACK', 'IMG_PROMO_WHITE'],
  variations: [
    { id: 'VAR_PROMO_BLACK_S', name: 'Black, S', price: 3000, stock: 0 },
    { id: 'VAR_PROMO_WHITE_S', name: 'White, S', price: 3000, stock: 6 },
    // A second size keeps Size a real (multi-value) chip group; a lone value
    // renders as a non-interactive span.
    { id: 'VAR_PROMO_WHITE_M', name: 'White, M', price: 3000, stock: 2 },
  ],
});

// --- Related-products cluster ------------------------------------------------
//
// Viewed from SOURCE (brand Acme, category Decks), each of the others lands in
// a different scoring tier, so the order and the cap are both observable:
//
//   ACME_TRUCKS    Acme   Trucks      100  same brand, complementary category
//   ACME_DECK_TWO  Acme   Decks        80  same brand, same category
//                                          (every variation sold out)
//   ZETA_WHEELS    Zeta   Wheels       60  complementary category
//   ZETA_DECK      Zeta   Decks        40  same category
//                                          (default size sold out, another in stock)
//   ACME_STICKER   Acme   Test Goods   20  same brand only
//   ACME_CAP       Acme   Test Goods   20  same brand only: the sixth, cut by the cap
//   UNRELATED_HAT  Zeta   Test Goods    0  no relationship: never shown
const solo = (id, price = 2000, stock = 5) => [
  { id, name: 'Regular', price, stock },
];
const item = (id, name, brand, category, variations, images = []) =>
  product({
    id,
    name,
    description: `${name} (related-products fixture).`,
    images: images.length ? images : [`IMG_${id.slice(0, 12)}`],
    brand,
    categoryIds: [category.id],
    variations,
  });

export const SOURCE = item(
  'RELSOURCE00000000000000DD',
  'Source Deck',
  'Acme',
  DECKS,
  solo('VAR_SOURCE')
);
export const ACME_TRUCKS = item(
  'RELACMETRUCKS000000000EE1',
  'Acme Trucks',
  'Acme',
  TRUCKS,
  solo('VAR_ACME_TRUCKS')
);
export const ACME_DECK_TWO = item(
  'RELACMEDECKTWO0000000EE2',
  'Acme Deck Two',
  'Acme',
  DECKS,
  [
    { id: 'VAR_ACME_DECK_TWO_8', name: '8.0', price: 6000, stock: 0 },
    { id: 'VAR_ACME_DECK_TWO_825', name: '8.25', price: 6000, stock: 0 },
  ]
);
export const ZETA_WHEELS = item(
  'RELZETAWHEELS00000000EE3',
  'Zeta Wheels',
  'Zeta',
  WHEELS,
  solo('VAR_ZETA_WHEELS')
);
export const ZETA_DECK = item(
  'RELZETADECK0000000000EE4',
  'Zeta Deck',
  'Zeta',
  DECKS,
  [
    { id: 'VAR_ZETA_DECK_8', name: '8.0', price: 6000, stock: 0 },
    { id: 'VAR_ZETA_DECK_825', name: '8.25', price: 6000, stock: 4 },
  ]
);
export const ACME_STICKER = item(
  'RELACMESTICKER0000000EE5',
  'Acme Sticker',
  'Acme',
  CATEGORY,
  solo('VAR_ACME_STICKER')
);
export const ACME_CAP = item(
  'RELACMECAP00000000000EE6',
  'Acme Cap',
  'Acme',
  CATEGORY,
  solo('VAR_ACME_CAP')
);
export const UNRELATED_HAT = item(
  'RELUNRELATEDHAT000000EE7',
  'Unrelated Hat',
  'Zeta',
  CATEGORY,
  solo('VAR_UNRELATED_HAT')
);

export const RELATED_CLUSTER = [
  SOURCE,
  ACME_TRUCKS,
  ACME_DECK_TWO,
  ZETA_WHEELS,
  ZETA_DECK,
  ACME_STICKER,
  ACME_CAP,
  UNRELATED_HAT,
];

export const PRODUCTS = [TEE, DECK, PROMO, ...RELATED_CLUSTER];

export { imageUrl };
