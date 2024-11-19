import type { CartItem, OrderRequest } from '@/lib/types';
import { squareClient } from '@/lib/square-client';

class CartManager {
  private static instance: CartManager;
  private items: Map<string, CartItem>;
  private storage: Storage | null;
  private initialized: boolean;

  private constructor() {
    this.items = new Map();
    this.storage = null;
    this.initialized = false;
    if (typeof window !== 'undefined') {
      // Defer initialization to ensure window is available
      setTimeout(() => this.init(), 0);
    }
  }

  private init(): void {
    if (this.initialized) return;
    this.storage = window.localStorage;
    this.loadCart();
    this.initialized = true;
    window.dispatchEvent(new Event('cartUpdated'));
  }

  static getInstance(): CartManager {
    if (!CartManager.instance) {
      CartManager.instance = new CartManager();
    }
    return CartManager.instance;
  }

  private loadCart(): void {
    if (!this.storage) return;
    try {
      const savedCart = this.storage.getItem('cart');
      if (savedCart) {
        const items = JSON.parse(savedCart);
        this.items.clear();
        items.forEach((item: CartItem) => {
          this.items.set(item.id, item);
        });
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  }

  private saveCart(): void {
    if (!this.storage) return;
    try {
      const items = Array.from(this.items.values());
      this.storage.setItem('cart', JSON.stringify(items));
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  }

  async createOrder(): Promise<string> {
    try {
      const lineItems = Array.from(this.items.values()).map(item => ({
        quantity: item.quantity.toString(),
        catalogObjectId: item.catalogObjectId,
        itemType: 'ITEM'
      }));

      const orderRequest: OrderRequest = {
        idempotencyKey: crypto.randomUUID(),
        order: {
          lineItems,
          locationId: import.meta.env.PUBLIC_SQUARE_LOCATION_ID
        }
      };

      const response = await squareClient.ordersApi.createOrder(orderRequest);

      if (!response.result.order?.id) {
        throw new Error('Failed to create order: No order ID returned');
      }

      return response.result.order.id;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  addItem(item: CartItem): void {
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
    this.saveCart();
  }

  removeItem(id: string): void {
    this.items.delete(id);
    this.saveCart();
  }

  updateQuantity(id: string, quantity: number): void {
    const item = this.items.get(id);
    if (item) {
      item.quantity = quantity;
      this.items.set(id, item);
      this.saveCart();
    }
  }

  getItems(): CartItem[] {
    return Array.from(this.items.values());
  }

  getTotal(): number {
    return Array.from(this.items.values()).reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
  }

  getItemCount(): number {
    return Array.from(this.items.values()).reduce(
      (total, item) => total + item.quantity,
      0
    );
  }

  clear(): void {
    this.items.clear();
    this.saveCart();
  }

  forceRefresh(): void {
    this.loadCart();
    window.dispatchEvent(new Event('cartUpdated'));
  }
}

export const cart = CartManager.getInstance();