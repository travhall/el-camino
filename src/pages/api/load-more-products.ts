// src/pages/api/load-more-products.ts
import type { APIRoute } from "astro";
import { fetchProductsByCategory } from "@/lib/square/categories";
import { processSquareError, handleError } from "@/lib/square/errorUtils";

export const prerender = false; // Dynamic endpoint

export const POST: APIRoute = async ({ request }) => {
  try {
    const { categoryId, cursor, limit = 24 } = await request.json();

    if (!categoryId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Category ID required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate limit (1-100, Square API constraint)
    const validLimit = Math.max(1, Math.min(Number(limit), 100));

    // Use enhanced fetchProductsByCategory with pagination
    const result = await fetchProductsByCategory(categoryId, {
      limit: validLimit,
      cursor,
      includeInventory: true,
    });

    return new Response(
      JSON.stringify({
        success: true,
        products: result.products,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const appError = processSquareError(error, "load-more-products");
    console.error("[load-more-products] Error:", appError);

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
