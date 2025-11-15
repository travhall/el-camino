// src/lib/cart/cartHelpers.ts
import type { CartItem } from "./types";

export function getItemKey(item: CartItem): string {
  return `${item.id}:${item.variationId}`;
}

export function calculateItemSubtotal(item: CartItem): number {
  // Use sale price if available, otherwise use regular price
  const effectivePrice = item.saleInfo?.salePrice ?? item.price;
  return effectivePrice * item.quantity;
}

export function getStockStatus(inventory: number) {
  return {
    isOutOfStock: inventory <= 0,
    isLowStock: inventory > 0 && inventory <= 5,
    maxQuantity: Math.min(inventory, 99),
  };
}

export function validateQuantityChange(
  cart: any,
  itemKey: string,
  newQuantity: number,
  inventoryData: Record<string, number>
): { valid: boolean; message?: string } {
  const [productId, variationId] = itemKey.split(":");
  const totalInventory = inventoryData[variationId] || 0;

  // Check basic constraints
  if (newQuantity < 0) {
    return { valid: false, message: "Quantity cannot be negative" };
  }

  if (newQuantity === 0) {
    return { valid: true }; // Allow removal
  }

  if (totalInventory <= 0) {
    return { valid: false, message: "Item is out of stock" };
  }

  if (newQuantity > totalInventory) {
    return { valid: false, message: `Only ${totalInventory} available` };
  }

  // Get current quantity in cart
  const items = cart.getItems();
  const currentItem = items.find((i: CartItem) => getItemKey(i) === itemKey);
  const currentQuantity = currentItem?.quantity || 0;

  // Calculate the change needed
  const quantityChange = newQuantity - currentQuantity;

  // Use cart's availability system for validation
  const canAdd = cart.canAddToCart(
    productId,
    variationId,
    totalInventory,
    quantityChange
  );

  if (!canAdd) {
    if (quantityChange > 0) {
      const available = Math.max(0, totalInventory - currentQuantity);
      return {
        valid: false,
        message:
          available > 0
            ? `Only ${available} more can be added`
            : "Cannot add more items - inventory limit reached",
      };
    }
  }

  return { valid: true };
}
