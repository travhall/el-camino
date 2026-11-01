// src/lib/square/variationImages.ts
import type { ProductVariation } from './types';

/**
 * Fill in per-variation images from the product-level image list.
 *
 * Covers the common Square pattern where images are stored at the Item level
 * (itemData.imageIds) rather than on each ItemVariation:
 *
 * - **Color variants**: one product image per color, matched by the order the
 *   colors first appear in the catalog. Sets `variation.image`.
 * - **No color attribute**: the images are multi-angle shots shared by every
 *   variation (e.g. a deck in several sizes). Sets `variation.images` to the
 *   full list, and `variation.image` to the first.
 *
 * A variation's own image(s) always win; nothing is overwritten.
 *
 * Mutates the variations in place, deliberately: the PDP and QuickView hold
 * references to these objects in several places (selection state, selected
 * variation, the serialized page data), and all of them need to see the result.
 *
 * Precondition: `variation.attributes` has already been parsed (run
 * `createInitialSelectionState` first). A variation with no parsed attributes
 * is treated as having no color.
 *
 * cSpell:ignore colour
 */
export function assignProductImagesToVariations(
  variations: ProductVariation[],
  productImages: string[] | undefined
): void {
  if (!productImages || productImages.length <= 1) return;

  const colorKey = Object.keys(variations[0]?.attributes ?? {}).find(
    (k) => k.toLowerCase() === 'color' || k.toLowerCase() === 'colour'
  );

  if (colorKey) {
    // Collect unique color values in catalog order (first-seen order)
    const colorOrder: string[] = [];
    for (const v of variations) {
      const c = v.attributes?.[colorKey];
      if (c && !colorOrder.includes(c)) colorOrder.push(c);
    }

    // Only map when there are at least as many product images as colors
    if (productImages.length >= colorOrder.length) {
      for (const v of variations) {
        if (v.image) continue; // Variation-level image always wins
        const colorValue = v.attributes?.[colorKey];
        const idx = colorOrder.indexOf(colorValue ?? '');
        if (idx >= 0 && productImages[idx]) {
          v.image = productImages[idx];
        }
      }
    }
  } else {
    // No color attribute: assign the full array to every variation that
    // doesn't already have variation-level images.
    for (const v of variations) {
      if (!v.images || v.images.length === 0) {
        v.images = productImages;
        if (!v.image) v.image = productImages[0];
      }
    }
  }
}
