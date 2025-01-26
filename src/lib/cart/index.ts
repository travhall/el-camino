// src/lib/cart/index.ts
import type { CartItem, CartEvent, CartState } from "./types";
import type { OrderRequest } from "../square/types";
import { Client, Environment } from "square";

const CART_STORAGE_KEY = "cart";
const VIEW_TRANSITION_EVENT = "astro:after-swap";
const PAGE_LOAD_EVENT = "astro:page-load";
const DOM_READY_DELAY = 50;

const squareClient = new Client({
  accessToken: import.meta.env.SQUARE_ACCESS_TOKEN || "",
  environment: Environment.Sandbox,
  squareVersion: "2024-02-28",
});

interface ICartManager {
  getItems(): CartItem[];
  getTotal(): number;
  getItemCount(): number;
  getState(): CartState;
  addItem(item: CartItem): void;
  removeItem(id: string): void;
  updateQuantity(id: string, quantity: number): void;
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
    if (!this.storage) return;
    try {
      const savedCart = this.storage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const items = JSON.parse(savedCart);
        this.items.clear();
        items.forEach((item: CartItem) => {
          this.items.set(item.id, item);
        });
      }
    } catch (error) {
      console.error("Error loading cart:", error);
      this.items.clear();
    }
  }

  private saveCart(): void {
    if (!this.storage) return;
    try {
      const items = Array.from(this.items.values());
      this.storage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      this.dispatchCartEvent("cartUpdated", { cartState: this.getState() });
    } catch (error) {
      console.error("Error saving cart:", error);
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

  public addItem(item: CartItem): void {
    if (!this.initialized) {
      this.init();
    }

    const existingItem = this.items.get(item.id);
    if (existingItem) {
      existingItem.quantity += item.quantity;
      this.items.set(item.id, existingItem);
    } else {
      this.items.set(item.id, item);
    }

    this.queueUpdate(() => {
      this.saveCart();
      this.dispatchCartEvent("itemAdded", { item });
    });
  }

  public removeItem(id: string): void {
    const item = this.items.get(id);
    if (item) {
      this.items.delete(id);
      this.queueUpdate(() => {
        this.saveCart();
        this.dispatchCartEvent("itemRemoved", { item });
      });
    }
  }

  public updateQuantity(id: string, quantity: number): void {
    const item = this.items.get(id);
    if (item) {
      item.quantity = quantity;
      this.items.set(id, item);
      this.queueUpdate(() => this.saveCart());
    }
  }

  public clear(): void {
    this.items.clear();
    this.queueUpdate(() => {
      this.dispatchCartEvent("cartCleared");
      this.saveCart();
    });
  }

  public async createOrder(): Promise<string> {
    if (!import.meta.env.PUBLIC_SQUARE_LOCATION_ID) {
      throw new Error("Square location ID is not configured");
    }

    try {
      const lineItems = Array.from(this.items.values()).map((item) => ({
        quantity: item.quantity.toString(),
        catalogObjectId: item.catalogObjectId,
        itemType: "ITEM",
      }));

      const orderRequest: OrderRequest = {
        idempotencyKey: crypto.randomUUID(),
        order: {
          lineItems,
          locationId: import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
        },
      };

      const response = await squareClient.ordersApi.createOrder(orderRequest);

      if (!response.result.order?.id) {
        throw new Error("Failed to create order: No order ID returned");
      }

      return response.result.order.id;
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
