// src/pages/api/render-product-card.ts
import type { APIRoute } from "astro";
import type { Product } from "@/lib/square/types";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { product }: { product: Product } = await request.json();

    if (!product || !product.id) {
      return new Response("Invalid product data", { status: 400 });
    }

    // For now, return JSON data - frontend will create DOM elements
    // This approach is more reliable than server-side component rendering in API routes
    return new Response(
      JSON.stringify({
        success: true,
        product: product,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in render-product-card:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to process product",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
