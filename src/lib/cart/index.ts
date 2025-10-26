// src/lib/cart/index.ts - COMPLETE FIXED VERSION
import type { CartItem, CartEvent, CartState } from "./types";
import type { ProductAvailabilityInfo } from "../square/types";
import { checkBulkInventory } from "../square/inventory";
import { ProductAvailabilityState, getAvailabilityInfo } from "../square/types";

const CART_STORAGE_KEY = "cart";
const VIEW_TRANSITION_EVENT = "astro:after-swap";
const PAGE_LOAD_EVENT = "astro:page-load";
const DOM_READY_DELAY = 50;

// ❌ REMOVED: Frontend Square client - this was causing CORS errors
// const squareClient = new Client({
//   accessToken: import.meta.env.SQUARE_ACCESS_TOKEN || "",
//   environment: Environment.Sandbox,
//   squareVersion: "2024-02-28",
// });

interface ICartManager {
  getItems(): CartItem[];
  getTotal(): number;
  getItemCount(): number;
  getState(): CartState;
  addItem(item: CartItem): Promise<{ success: boolean; message?: string }>;
  removeItem(id: string): void;
  updateQuantity(
    id: string,
    quantity: number
  ): Promise<{ success: boolean; message?: string }>;
  validateCart(): Promise<{ success: boolean; message?: string }>;
  clear(): void;
  forceRefresh(): void;
  createOrder(): Promise<string>;
}

class CartManager implements ICartManager {
  private static instance: CartManager;
  private items: Map<string, CartItem>;
  private storage: Storage | null;
  private initialized: boolean;
  private updateQueue: Array<() => void>;
  private isProcessing: boolean;

  private constructor() {
    this.items = new Map();
    this.storage = typeof window !== "undefined" ? window.localStorage : null;
    this.initialized = false;
    this.updateQueue = [];
    this.isProcessing = false;

    if (typeof window !== "undefined") {
      this.init();
      this.setupEventHandlers();
    }
  }

  static getInstance(): CartManager {
    if (!CartManager.instance) {
      CartManager.instance = new CartManager();
    }
    return CartManager.instance;
  }

  private init(): void {
    if (this.initialized) return;
    this.loadCart();
    this.initialized = true;
    this.queueUpdate(() =>
      this.dispatchCartEvent("cartUpdated", { cartState: this.getState() })
    );
  }

  private queueUpdate(update: () => void): void {
    this.updateQueue.push(update);
    this.processUpdateQueue();
  }

  private async processUpdateQueue(): Promise<void> {
    if (this.isProcessing || this.updateQueue.length === 0) return;

    this.isProcessing = true;
    await new Promise((resolve) => setTimeout(resolve, DOM_READY_DELAY));

    while (this.updateQueue.length > 0) {
      const update = this.updateQueue.shift();
      if (update) {
        try {
          update();
        } catch (error) {
          console.error("Error processing update:", error);
        }
      }
    }

    this.isProcessing = false;
  }

  private setupEventHandlers(): void {
    if (typeof window === "undefined") return;

    const handleStateUpdate = () => {
      this.queueUpdate(() => {
        this.loadCart();
        this.dispatchCartEvent("cartUpdated", { cartState: this.getState() });
      });
    };

    window.addEventListener(VIEW_TRANSITION_EVENT, handleStateUpdate);
    window.addEventListener(PAGE_LOAD_EVENT, handleStateUpdate);

    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        window.removeEventListener(VIEW_TRANSITION_EVENT, handleStateUpdate);
        window.removeEventListener(PAGE_LOAD_EVENT, handleStateUpdate);
      });
    }
  }

  private loadCart(): void {
    if (!this.storage) {
      console.error("Storage not available");
      return;
    }

    try {
      // console.log("Loading cart from localStorage");
      const savedCart = this.storage.getItem(CART_STORAGE_KEY);

      if (!savedCart) {
        // console.log("No saved cart found in localStorage");
        return;
      }

      const items = JSON.parse(savedCart);
      // console.log(`Loaded ${items.length} items from localStorage:`, items);

      // Clear existing items and add loaded ones
      this.items.clear();

      if (Array.isArray(items)) {
        items.forEach((item: CartItem) => {
          if (item && item.id && item.quantity > 0) {
            // console.log(
            //   `Adding item to cart from storage: ${item.title || item.id}`
            // );
            // Create compound key for each item
            const itemKey = `${item.id}:${item.variationId}`;
            this.items.set(itemKey, item);
          }
        });
      } else {
        console.warn("Saved cart is not an array:", items);
      }

      // console.log(`Cart now has ${this.items.size} items after loading`);
    } catch (error) {
      console.error("Error loading cart:", error);
      this.items.clear();
    }
  }

  private saveCart(): void {
    if (!this.storage) {
      console.error("Storage not available");
      return;
    }

    try {
      // console.log("Saving cart to localStorage");
      const items = Array.from(this.items.values());

      // Create deep clone to avoid reference issues
      const itemsToSave = items.map((item) => ({ ...item }));

      // Log what we're saving
      // console.log(
      //   `Saving ${itemsToSave.length} items to localStorage:`,
      //   itemsToSave
      // );

      // Serialize and save
      const serialized = JSON.stringify(itemsToSave);
      this.storage.setItem(CART_STORAGE_KEY, serialized);

      // Verify data was saved correctly
      const savedData = this.storage.getItem(CART_STORAGE_KEY);
      const parsedData = savedData ? JSON.parse(savedData) : [];
      // console.log(
      //   `Verification: saved ${parsedData.length} items to localStorage`
      // );

      // Dispatch event after successful save
      this.dispatchCartEvent("cartUpdated", { cartState: this.getState() });
    } catch (error) {
      console.error("Error saving cart:", error);

      // Fallback - try saving without extra data if the serialization failed
      try {
        const simpleItems = Array.from(this.items.values()).map((item) => ({
          id: item.id,
          variationId: item.variationId,
          catalogObjectId: item.catalogObjectId,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
          variationName: item.variationName,
        }));

        this.storage.setItem(CART_STORAGE_KEY, JSON.stringify(simpleItems));
        // console.log("Saved cart with simplified data");
      } catch (fallbackError) {
        console.error("Critical error saving cart:", fallbackError);
      }
    }
  }

  private dispatchCartEvent(
    type: CartEvent["type"],
    detail?: CartEvent["detail"]
  ): void {
    if (typeof window === "undefined") return;

    const event = new CustomEvent(type, {
      detail,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
  }

  public getState(): CartState {
    return {
      items: this.getItems(),
      total: this.getTotal(),
      itemCount: this.getItemCount(),
    };
  }

  public getItems(): CartItem[] {
    return Array.from(this.items.values());
  }

  public getTotal(): number {
    return Array.from(this.items.values()).reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
  }

  public getItemCount(): number {
    return Array.from(this.items.values()).reduce(
      (total, item) => total + item.quantity,
      0
    );
  }

  public getVariationQuantity(productId: string, variationId: string): number {
    const itemKey = `${productId}:${variationId}`;
    const item = this.items.get(itemKey);
    return item?.quantity || 0;
  }

  public getRemainingQuantity(
    productId: string,
    variationId: string,
    totalAvailable: number
  ): number {
    const inCart = this.getVariationQuantity(productId, variationId);
    return Math.max(0, totalAvailable - inCart);
  }

  /**
   * Get availability information for a product variation including cart state
   * @param productId Product ID
   * @param variationId Variation ID
   * @param totalInventory Total inventory available from Square API
   * @returns ProductAvailabilityInfo with current state
   */
  public getProductAvailability(
    productId: string,
    variationId: string,
    totalInventory: number
  ): ProductAvailabilityInfo {
    const inCart = this.getVariationQuantity(productId, variationId);
    return getAvailabilityInfo(totalInventory, inCart);
  }

  /**
   * Get availability state only (without full info object)
   * @param productId Product ID
   * @param variationId Variation ID
   * @param totalInventory Total inventory available from Square API
   * @returns ProductAvailabilityState
   */
  public getProductAvailabilityState(
    productId: string,
    variationId: string,
    totalInventory: number
  ): ProductAvailabilityState {
    const info = this.getProductAvailability(
      productId,
      variationId,
      totalInventory
    );
    return info.state;
  }

  /**
   * Check if a product can be added to cart based on current availability
   * @param productId Product ID
   * @param variationId Variation ID
   * @param totalInventory Total inventory available
   * @param requestedQuantity Quantity trying to add (default: 1)
   * @returns boolean indicating if add is allowed
   */
  public canAddToCart(
    productId: string,
    variationId: string,
    totalInventory: number,
    requestedQuantity: number = 1
  ): boolean {
    const info = this.getProductAvailability(
      productId,
      variationId,
      totalInventory
    );

    // Can't add if out of stock
    if (info.state === ProductAvailabilityState.OUT_OF_STOCK) {
      return false;
    }

    // Can't add if all available items are already in cart
    if (info.state === ProductAvailabilityState.ALL_IN_CART) {
      return false;
    }

    // Check if requested quantity would exceed remaining
    return requestedQuantity <= info.remaining;
  }

  /**
   * Get the maximum quantity that can be added to cart right now
   * @param productId Product ID
   * @param variationId Variation ID
   * @param totalInventory Total inventory available
   * @returns maximum addable quantity
   */
  public getMaxAddableQuantity(
    productId: string,
    variationId: string,
    totalInventory: number
  ): number {
    const info = this.getProductAvailability(
      productId,
      variationId,
      totalInventory
    );
    return Math.max(0, info.remaining);
  }

  /**
   * ✅ FIXED: Use backend API instead of direct Square API calls
   */
  public async addItem(
    item: CartItem
  ): Promise<{ success: boolean; message?: string }> {
    if (!this.initialized) {
      this.init();
    }

    // console.log(`Starting to add item ${item.title} (${item.variationId})`);

    try {
      // Ensure quantity is a valid number
      const requestedQuantity =
        item.quantity && item.quantity > 0 ? item.quantity : 1;
      // console.log(`Requested quantity: ${requestedQuantity}`);

      // Check if item is in stock using backend API
      let availableQuantity = 0;

      try {
        // ✅ FIXED: Use backend API endpoint instead of direct Square API
        const response = await fetch(
          `/api/check-inventory?variationId=${item.variationId}`
        );

        if (!response.ok) {
          throw new Error(`Inventory API returned ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          availableQuantity = data.quantity || 0;
        } else {
          throw new Error(data.error || "Unknown inventory check error");
        }

        // console.log(
        //   `Item ${item.variationId} available quantity: ${availableQuantity}`
        // );
      } catch (inventoryError) {
        console.warn(
          "Inventory check failed, proceeding with add:",
          inventoryError
        );
        // If inventory check fails, we'll still try to add the item
        // This prevents network errors from blocking all purchases
        availableQuantity = 999; // Set a high number to allow the purchase to proceed
      }

      // Only block completely out of stock items
      if (availableQuantity <= 0) {
        // console.log(`Item is out of stock`);
        return {
          success: false,
          message: "This item is out of stock",
        };
      }

      // Create a compound key using both product ID and variation ID
      const itemKey = `${item.id}:${item.variationId}`;

      // Check if this specific variation is already in the cart
      const existingItem = this.items.get(itemKey);

      // console.log(`Checking cart for item with key: ${itemKey}`);
      // console.log(`Existing item found?`, existingItem ? "Yes" : "No");

      // Calculate current cart quantity and new total
      const currentCartQty = existingItem?.quantity || 0;
      const newTotalQty = currentCartQty + requestedQuantity;

      // console.log(
      //   `Current quantity in cart: ${currentCartQty}, Adding: ${requestedQuantity}, New total would be: ${newTotalQty}, Available: ${availableQuantity}`
      // );

      // Check if adding would exceed available inventory
      if (newTotalQty > availableQuantity) {
        // If we're already at max, return error
        if (currentCartQty >= availableQuantity) {
          return {
            success: false,
            message: `You already have the maximum available quantity (${currentCartQty}) in your cart`,
          };
        }

        // Otherwise add what we can
        const possibleToAdd = availableQuantity - currentCartQty;

        if (existingItem) {
          // Update existing item to maximum
          existingItem.quantity = availableQuantity;
          this.items.set(itemKey, existingItem);
          // console.log(`Updated item quantity to maximum: ${availableQuantity}`);
        } else {
          // Add new item with maximum quantity
          const newItem = { ...item, quantity: possibleToAdd };
          this.items.set(itemKey, newItem);
          // console.log(`Added new item with maximum quantity: ${possibleToAdd}`);
        }

        // Save changes
        this.saveCart();
        this.dispatchCartEvent("itemAdded", { item });
        this.dispatchCartEvent("cartUpdated", { cartState: this.getState() });

        return {
          success: true,
          message: `Added ${possibleToAdd} to cart (maximum available)`,
        };
      }

      // Normal flow - add or update with requested quantity
      if (existingItem) {
        // Update with the NEW TOTAL quantity
        existingItem.quantity = newTotalQty;
        this.items.set(itemKey, existingItem);
        // console.log(`Updated existing item, new quantity: ${newTotalQty}`);
      } else {
        // Create a deep copy with the requested quantity
        const newItem = {
          ...item,
          id: item.id,
          variationId: item.variationId,
          catalogObjectId: item.catalogObjectId || item.id,
          title: item.title,
          price: item.price,
          quantity: requestedQuantity, // Use requested quantity
          image: item.image,
          variationName: item.variationName,
          unit: item.unit,
        };

        this.items.set(itemKey, newItem);
        // console.log(`Added new item with quantity: ${requestedQuantity}`);
      }

      // Save changes and dispatch events
      this.saveCart();
      this.dispatchCartEvent("itemAdded", { item });
      this.dispatchCartEvent("cartUpdated", { cartState: this.getState() });

      return {
        success: true,
        message:
          requestedQuantity === 1
            ? "Added to cart"
            : `Added ${requestedQuantity} to cart`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Error adding item to cart:`, error);
      return {
        success: false,
        message: `Error adding item to cart: ${errorMessage}`,
      };
    }
  }

  public removeItem(id: string): void {
    // Check if this is a compound key (has colon)
    const item = id.includes(":") ? this.items.get(id) : this.items.get(id); // Legacy support

    if (item) {
      this.items.delete(id);
      this.queueUpdate(() => {
        this.saveCart();
        this.dispatchCartEvent("itemRemoved", { item });
        this.dispatchCartEvent("cartUpdated", { cartState: this.getState() });
      });
    }
  }

  public async updateQuantity(
    id: string,
    quantity: number
  ): Promise<{ success: boolean; message?: string }> {
    const item = this.items.get(id);
    if (!item) {
      return { success: false, message: "Item not found in cart" };
    }

    if (quantity <= 0) {
      this.removeItem(id);
      return { success: true };
    }
    item.quantity = quantity;
    this.items.set(id, item);
    this.queueUpdate(() => {
      this.saveCart();
      this.dispatchCartEvent("cartUpdated", { cartState: this.getState() });
    });

    return { success: true };
  }

  public async validateCart(): Promise<{ success: boolean; message?: string }> {
    try {
      const items = this.getItems();
      if (items.length === 0) {
        return { success: true };
      }

      // Get all variation IDs
      const variationIds = items.map((item) => item.variationId);

      // Check inventory - use backend inventory system
      const stockLevels = await checkBulkInventory(variationIds);

      let cartUpdated = false;
      let removedItems: string[] = [];
      let adjustedItems: Array<{
        name: string;
        oldQty: number;
        newQty: number;
      }> = [];

      // Check each item
      for (const item of items) {
        const availableQuantity = stockLevels[item.variationId] || 0;
        const itemKey = `${item.id}:${item.variationId}`;

        if (availableQuantity <= 0) {
          // Remove out of stock items
          this.removeItem(itemKey);
          removedItems.push(item.title);
          cartUpdated = true;
        } else if (item.quantity > availableQuantity) {
          // Adjust quantities to match available stock
          adjustedItems.push({
            name: item.title,
            oldQty: item.quantity,
            newQty: availableQuantity,
          });

          item.quantity = availableQuantity;
          this.items.set(itemKey, item);
          cartUpdated = true;
        }
      }

      if (cartUpdated) {
        this.saveCart();
      }

      // Generate message
      let message = "";
      if (removedItems.length > 0) {
        message += `Removed out-of-stock item${
          removedItems.length > 1 ? "s" : ""
        }: ${removedItems.join(", ")}. `;
      }
      if (adjustedItems.length > 0) {
        message += `Adjusted quantities for: ${adjustedItems
          .map((i) => `${i.name} (${i.oldQty} → ${i.newQty})`)
          .join(", ")}. `;
      }

      return {
        success: true,
        message: message.length > 0 ? message : undefined,
      };
    } catch (error) {
      console.error("Error validating cart:", error);
      return {
        success: false,
        message: "Failed to validate cart",
      };
    }
  }

  public clear(): void {
    this.items.clear();
    this.queueUpdate(() => {
      this.dispatchCartEvent("cartCleared");
      this.dispatchCartEvent("cartUpdated", { cartState: this.getState() });
      this.saveCart();
    });
  }

  public async createOrder(): Promise<string> {
    if (!import.meta.env.PUBLIC_SQUARE_LOCATION_ID) {
      throw new Error("Square location ID is not configured");
    }

    // Validate cart before creating order
    const validation = await this.validateCart();
    if (!validation.success) {
      throw new Error("Failed to validate cart");
    }

    // If validation updated the cart, inform the user
    if (validation.message) {
      console.warn("Cart updated during order creation:", validation.message);
    }

    try {
      // ✅ Use backend API for order creation
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: Array.from(this.items.values()),
        }),
      });

      if (!response.ok) {
        throw new Error(`Order creation failed with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.orderId) {
        throw new Error(
          data.error || "Failed to create order: No order ID returned"
        );
      }

      return data.orderId;
    } catch (error) {
      console.error("Error creating order:", error);
      throw error;
    }
  }

  public forceRefresh(): void {
    this.queueUpdate(() => {
      this.loadCart();
      this.dispatchCartEvent("cartUpdated", { cartState: this.getState() });
    });
  }
}

export const cart = CartManager.getInstance();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    CartManager.getInstance().forceRefresh();
  });
}
