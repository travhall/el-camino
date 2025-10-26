// src/pages/api/load-more-products.ts - FINAL OPTIMIZED VERSION
import type { APIRoute } from "astro";
import { fetchProductsByCategory } from "@/lib/square/categories";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { categoryId, cursor, limit = 24 } = await request.json();

    if (!categoryId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Category ID required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await fetchProductsByCategory(categoryId, {
      limit: Math.min(Number(limit), 100),
      cursor,
    });

    return new Response(
      JSON.stringify({
        success: true,
        products: result.products,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // console.error("[API] Load more products error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to load products",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
