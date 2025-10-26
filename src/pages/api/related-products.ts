// src/pages/api/related-products.ts
import type { APIRoute } from "astro";
import { fetchProducts } from "@/lib/square/client";
import { getRelatedProducts } from "@/lib/product/relatedProducts";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const maxResults = parseInt(url.searchParams.get("maxResults") || "6");

  if (!productId) {
    return new Response(
      JSON.stringify({ error: "Missing productId parameter" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // console.log(`[related-products] Fetching for product: ${productId}`);
    const startTime = Date.now();

    // Fetch all products (this will be cached)
    const allProducts = await fetchProducts();

    // Find the source product
    const sourceProduct = allProducts.find((p) => p.id === productId);

    if (!sourceProduct) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get related products
    const result = await getRelatedProducts(sourceProduct, allProducts, {
      maxResults,
      excludeOutOfStock: false,
    });

    const duration = Date.now() - startTime;
    // console.log(
    //   `[related-products] Found ${result.products.length} related products in ${duration}ms`
    // );

    const response = new Response(
      JSON.stringify({ products: result.products }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );

    // Cache for 15 minutes at CDN
    response.headers.set(
      "Cache-Control",
      "public, max-age=60, stale-while-revalidate=900"
    );
    response.headers.set(
      "Netlify-CDN-Cache-Control",
      "public, s-maxage=900, stale-while-revalidate=3600, durable"
    );
    response.headers.set("Netlify-Cache-Tag", "related-products,products");

    return response;
  } catch (error) {
    // console.error("[related-products] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
