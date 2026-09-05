/**
 * Unit tests for relatedProducts.ts's scoring/filtering algorithm.
 *
 * Reduced scope (plan 141): the 3 category-dependent scoring tiers
 * (brand-category, complementary, category-only) are currently unreachable
 * in production — `scoreProduct`/`getRelatedProducts` extract a category
 * slug via `product.url.match(/\/category\/([^\/]+)/)`, but every real
 * `Product.url` is `/product/<slug>` (see `createProductUrl` in
 * `@/lib/square/slugUtils.ts`), never `/category/...`. Building fixtures
 * with a fake `/category/...` product URL to exercise those tiers would
 * paper over that bug rather than test real behavior, so this file only
 * covers what's reachable today plus `getComplementaryCategories`. The fix
 * (resolving category slugs from `Product.categories`/`reportingCategoryId`
 * instead of `.url`) and the full 5-tier test matrix are tracked in
 * plans/145-fix-related-products-category-matching.md.
 */
import { describe, it, expect } from "vitest";
import {
  getRelatedProducts,
  getComplementaryCategories,
} from "@/lib/product/relatedProducts";
import type { Product } from "@/lib/square/types";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-1",
    catalogObjectId: "catalog-1",
    variationId: "variation-1",
    title: "Test Product",
    image: "/images/test.jpg",
    price: 1000,
    url: "/product/test-product",
    brand: "brand-a",
    variations: [{ id: "v1", variationId: "variation-1", name: "Default", price: 1000, inStock: true }],
    ...overrides,
  };
}

describe("getRelatedProducts", () => {
  it("scores same-brand-only products (no category match) and reports brand-only/low", async () => {
    const source = makeProduct({ id: "source", brand: "brand-a" });
    const sameBrand = makeProduct({ id: "same-brand", brand: "brand-a" });

    const result = await getRelatedProducts(source, [source, sameBrand]);

    expect(result.products.map((p) => p.id)).toEqual(["same-brand"]);
    expect(result.matchType).toBe("brand-only");
    expect(result.confidence).toBe("low");
  });

  it("excludes products with no relationship at all (score 0)", async () => {
    const source = makeProduct({ id: "source", brand: "brand-a" });
    const unrelated = makeProduct({ id: "unrelated", brand: "brand-b" });

    const result = await getRelatedProducts(source, [source, unrelated]);

    expect(result.products).toEqual([]);
  });

  it("never includes the source product itself, even though it would otherwise score", async () => {
    const source = makeProduct({ id: "source", brand: "brand-a" });

    const result = await getRelatedProducts(source, [source]);

    expect(result.products).toEqual([]);
  });

  it("filters out a candidate whose every variation is out of stock when excludeOutOfStock is true", async () => {
    const source = makeProduct({ id: "source", brand: "brand-a" });
    const outOfStock = makeProduct({
      id: "out-of-stock",
      brand: "brand-a",
      variations: [{ id: "v1", variationId: "variation-1", name: "Default", price: 1000, inStock: false }],
    });
    const inStock = makeProduct({
      id: "in-stock",
      brand: "brand-a",
      variations: [
        { id: "v1", variationId: "variation-1", name: "Default", price: 1000, inStock: false },
        { id: "v2", variationId: "variation-2", name: "Alt", price: 1200, inStock: true },
      ],
    });

    const result = await getRelatedProducts(
      source,
      [source, outOfStock, inStock],
      { maxResults: 6, excludeOutOfStock: true }
    );

    expect(result.products.map((p) => p.id)).toEqual(["in-stock"]);
  });

  it("keeps out-of-stock candidates when excludeOutOfStock is not set", async () => {
    const source = makeProduct({ id: "source", brand: "brand-a" });
    const outOfStock = makeProduct({
      id: "out-of-stock",
      brand: "brand-a",
      variations: [{ id: "v1", variationId: "variation-1", name: "Default", price: 1000, inStock: false }],
    });

    const result = await getRelatedProducts(source, [source, outOfStock]);

    expect(result.products.map((p) => p.id)).toEqual(["out-of-stock"]);
  });

  it("caps returned products at config.maxResults even when more candidates score above 0", async () => {
    const source = makeProduct({ id: "source", brand: "brand-a" });
    const candidates = [1, 2, 3, 4].map((n) =>
      makeProduct({ id: `same-brand-${n}`, brand: "brand-a" })
    );

    const result = await getRelatedProducts(source, [source, ...candidates], {
      maxResults: 2,
    });

    expect(result.products).toHaveLength(2);
  });

  it("sorts results by score descending", async () => {
    const source = makeProduct({ id: "source", brand: "brand-a" });
    // Same brand only (score 20) vs. no relationship (score 0, filtered) —
    // add a second same-brand candidate to assert stable non-decreasing order.
    const brandMatchOne = makeProduct({ id: "brand-match-1", brand: "brand-a" });
    const brandMatchTwo = makeProduct({ id: "brand-match-2", brand: "brand-a" });
    const noMatch = makeProduct({ id: "no-match", brand: "brand-z" });

    const result = await getRelatedProducts(source, [
      source,
      noMatch,
      brandMatchOne,
      brandMatchTwo,
    ]);

    expect(result.products.map((p) => p.id)).toEqual([
      "brand-match-1",
      "brand-match-2",
    ]);
  });

  it("returns an empty result with the documented complementary/low default for empty input", async () => {
    const source = makeProduct({ id: "source", brand: "brand-a" });

    const result = await getRelatedProducts(source, []);

    expect(result).toEqual({
      products: [],
      matchType: "complementary",
      confidence: "low",
    });
  });
});

describe("getComplementaryCategories", () => {
  it("returns the exact mapped array for a known category slug", () => {
    expect(getComplementaryCategories("decks")).toEqual([
      "trucks",
      "wheels",
      "bearings",
      "hardware",
      "grip-tape",
      "griptape",
    ]);
  });

  it("returns an empty array for an unknown category slug", () => {
    expect(getComplementaryCategories("not-a-real-category")).toEqual([]);
  });
});
