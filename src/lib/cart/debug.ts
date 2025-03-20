// src/lib/cart/debug.ts
import { cart } from "./index";

export function debugCart(): void {
  console.log("--- CART DEBUG INFO ---");
  console.log("Items:", cart.getItems());
  console.log("Total:", cart.getTotal());
  console.log("Item Count:", cart.getItemCount());

  // Check localStorage directly
  if (typeof window !== "undefined") {
    try {
      const rawStorage = localStorage.getItem("cart");
      console.log("Raw localStorage:", rawStorage);

      if (rawStorage) {
        try {
          const parsedStorage = JSON.parse(rawStorage);
          console.log("Parsed localStorage:", parsedStorage);
        } catch (e) {
          console.log("Error parsing localStorage:", e);
        }
      }
    } catch (e) {
      console.log("Error accessing localStorage:", e);
    }
  }

  console.log("----------------------");
}

// For easy debugging in the browser console
if (typeof window !== "undefined") {
  (window as any).debugCart = debugCart;
}
