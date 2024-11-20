import type { CartItem, CartEvent, CartState } from './types';
import { MoneyUtils } from '../square/money';
import type { OrderRequest } from '../square/types';
import { Client, Environment } from 'square';

// Initialize Square client here to avoid circular dependencies
const squareClient = new Client({
    accessToken: import.meta.env.SQUARE_ACCESS_TOKEN || '',
    environment: Environment.Sandbox,
    squareVersion: '2024-02-28'
});

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
            setTimeout(() => this.init(), 0);
        }
    }

    private init(): void {
        if (this.initialized) return;
        this.storage = window.localStorage;
        this.loadCart();
        this.initialized = true;
        this.dispatchCartEvent('cartUpdated');
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
            this.dispatchCartEvent('cartUpdated', { cartState: this.getState() });
        } catch (error) {
            console.error('Error saving cart:', error);
        }
    }

    private dispatchCartEvent(type: CartEvent['type'], detail?: CartEvent['detail']): void {
        if (typeof window === 'undefined') return;

        const event = new CustomEvent(type, {
            detail,
            bubbles: true,
            cancelable: true,
        });
        window.dispatchEvent(event);
    }

    private getState(): CartState {
        return {
            items: this.getItems(),
            total: this.getTotal(),
            itemCount: this.getItemCount()
        };
    }

    async createOrder(): Promise<string> {
        if (!import.meta.env.PUBLIC_SQUARE_LOCATION_ID) {
            throw new Error('Square location ID is not configured');
        }

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

        this.dispatchCartEvent('itemAdded', { item });
        this.saveCart();
    }

    removeItem(id: string): void {
        const item = this.items.get(id);
        if (item) {
            this.items.delete(id);
            this.dispatchCartEvent('itemRemoved', { item });
            this.saveCart();
        }
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
            (total, item) => total + (item.price * item.quantity),
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
        this.dispatchCartEvent('cartCleared');
        this.saveCart();
    }

    forceRefresh(): void {
        this.loadCart();
        this.dispatchCartEvent('cartUpdated', { cartState: this.getState() });
    }
}

export const cart = CartManager.getInstance();