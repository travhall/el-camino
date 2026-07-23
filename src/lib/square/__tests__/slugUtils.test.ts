import { describe, it, expect } from "vitest";
import {
  createSlug,
  createVariantSlug,
  createProductUrl,
  extractIdFromSlug,
  createSlugMapping,
  getVariationFromVariantParam,
  createSEOTitle,
} from "../slugUtils";
import type { Product, ProductVariation } from "../types";

describe("createSlug", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(createSlug("Hello World")).toBe("hello-world");
  });

  it("removes non-slug characters", () => {
    expect(createSlug("Café & Bar!")).toBe("caf-bar");
  });

  it("collapses duplicate hyphens and trims leading/trailing ones", () => {
    expect(createSlug("  --Weird---Spacing--  ")).toBe("weird-spacing");
  });

  it("truncates to 50 characters", () => {
    const long = "a".repeat(60);
    const slug = createSlug(long);
    expect(slug.length).toBeLessThanOrEqual(50);
  });

  it("returns an empty string for a name with only special characters", () => {
    expect(createSlug("!!!???")).toBe("");
  });
});

describe("createVariantSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(createVariantSlug("Small, Red")).toBe("small-red");
  });

  it("removes punctuation", () => {
    expect(createVariantSlug("8.5\" Deck!")).toBe("85-deck");
  });

  it("returns an empty string for punctuation-only input", () => {
    expect(createVariantSlug("...")).toBe("");
  });
});

describe("createProductUrl", () => {
  it("builds a /product/<slug> path", () => {
    expect(createProductUrl({ title: "Baker Deck" })).toBe("/product/baker-deck");
  });
});

describe("extractIdFromSlug", () => {
  const mapping = new Map([["baker-deck", "SQID123"]]);

  it("returns the ID as-is when it looks like a raw Square ID", () => {
    const rawId = "A".repeat(24);
    expect(extractIdFromSlug(rawId, mapping)).toBe(rawId);
  });

  it("looks up the slug in the provided mapping", () => {
    expect(extractIdFromSlug("baker-deck", mapping)).toBe("SQID123");
  });

  it("returns null when the slug isn't in the mapping", () => {
    expect(extractIdFromSlug("unknown-slug", mapping)).toBeNull();
  });
});

describe("createSlugMapping", () => {
  const product = (id: string, title: string): Product =>
    ({ id, title } as Product);

  it("maps each product's slug to its ID", () => {
    const mapping = createSlugMapping([
      product("id-1", "Baker Deck"),
      product("id-2", "Anti-Hero Deck"),
    ]);
    expect(mapping.get("baker-deck")).toBe("id-1");
    expect(mapping.get("anti-hero-deck")).toBe("id-2");
  });

  it("disambiguates duplicate slugs with a counter suffix", () => {
    const mapping = createSlugMapping([
      product("id-1", "Baker Deck"),
      product("id-2", "Baker Deck"),
    ]);
    expect(mapping.get("baker-deck")).toBe("id-1");
    expect(mapping.get("baker-deck-1")).toBe("id-2");
  });

  it("returns an empty map for an empty product list", () => {
    expect(createSlugMapping([]).size).toBe(0);
  });
});

describe("getVariationFromVariantParam", () => {
  const variation = (name: string): ProductVariation =>
    ({ name } as ProductVariation);

  it("finds the variation whose slug matches the param", () => {
    const product = { variations: [variation("Small"), variation("Large")] } as Product;
    const found = getVariationFromVariantParam(product, "large");
    expect(found?.name).toBe("Large");
  });

  it("returns undefined when no variation matches", () => {
    const product = { variations: [variation("Small")] } as Product;
    expect(getVariationFromVariantParam(product, "extra-large")).toBeUndefined();
  });

  it("returns undefined when the product has no variations", () => {
    const product = { variations: undefined } as Product;
    expect(getVariationFromVariantParam(product, "small")).toBeUndefined();
  });

  it("returns undefined when variantParam is empty", () => {
    const product = { variations: [variation("Small")] } as Product;
    expect(getVariationFromVariantParam(product, "")).toBeUndefined();
  });
});

describe("createSEOTitle", () => {
  it("prepends the brand when the title doesn't already include it", () => {
    const product = { title: "Deck", brand: "Baker" } as Product;
    expect(createSEOTitle(product)).toBe("Baker Deck | El Camino");
  });

  it("does not duplicate the brand if the title already starts with it", () => {
    const product = { title: "Baker Deck", brand: "Baker" } as Product;
    expect(createSEOTitle(product)).toBe("Baker Deck | El Camino");
  });

  it("appends the variation name when present and distinct from the title", () => {
    const product = { title: "Baker Deck", brand: "Baker" } as Product;
    const variation = { name: "8.5\"" } as ProductVariation;
    expect(createSEOTitle(product, variation)).toBe('Baker Deck - 8.5" | El Camino');
  });

  it("omits the variation suffix when it equals the product title", () => {
    const product = { title: "Baker Deck" } as Product;
    const variation = { name: "Baker Deck" } as ProductVariation;
    expect(createSEOTitle(product, variation)).toBe("Baker Deck | El Camino");
  });
});
