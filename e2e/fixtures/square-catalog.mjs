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

function product({ id, name, description, images, variations, categoryIds }) {
  return {
    id,
    name,
    description,
    images,
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

export const PRODUCTS = [TEE, DECK, PROMO];

export { imageUrl };
