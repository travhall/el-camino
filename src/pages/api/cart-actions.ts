// src/pages/api/cart-actions.ts
import type { APIRoute } from "astro";
import { cart } from "@/lib/cart";
import type { CartItem } from "@/lib/cart/types";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { action, data } = await request.json();

    switch (action) {
      case "add": {
        const item = data as CartItem;
        cart.addItem(item);
        return new Response(
          JSON.stringify({
            success: true,
            cartState: {
              items: cart.getItems(),
              total: cart.getTotal(),
              itemCount: cart.getItemCount(),
            },
          })
        );
      }

      case "remove": {
        const { id } = data as { id: string };
        cart.removeItem(id);
        return new Response(
          JSON.stringify({
            success: true,
            cartState: {
              items: cart.getItems(),
              total: cart.getTotal(),
              itemCount: cart.getItemCount(),
            },
          })
        );
      }

      case "update": {
        const { id, quantity } = data as { id: string; quantity: number };
        cart.updateQuantity(id, quantity);
        return new Response(
          JSON.stringify({
            success: true,
            cartState: {
              items: cart.getItems(),
              total: cart.getTotal(),
              itemCount: cart.getItemCount(),
            },
          })
        );
      }

      case "clear": {
        cart.clear();
        return new Response(
          JSON.stringify({
            success: true,
            cartState: {
              items: [],
              total: 0,
              itemCount: 0,
            },
          })
        );
      }

      case "getState": {
        return new Response(
          JSON.stringify({
            success: true,
            cartState: {
              items: cart.getItems(),
              total: cart.getTotal(),
              itemCount: cart.getItemCount(),
            },
          })
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: "Invalid action" }),
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Cart action error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Cart action failed",
      }),
      { status: 500 }
    );
  }
};

export const GET: APIRoute = async () => {
  try {
    return new Response(
      JSON.stringify({
        success: true,
        cartState: {
          items: cart.getItems(),
          total: cart.getTotal(),
          itemCount: cart.getItemCount(),
        },
      })
    );
  } catch (error) {
    console.error("Cart state error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get cart state",
      }),
      { status: 500 }
    );
  }
};
