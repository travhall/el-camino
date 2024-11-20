// /src/lib/cart/types.ts
import type { Money } from '../square/types'; // 'Money' is declared but its value is never read.ts(6133)

export interface CartItem {
    id: string;
    catalogObjectId: string;
    variationId: string;
    title: string;
    price: number;  // Keep as number for compatibility
    quantity: number;
    image?: string;
}

export interface CartState {
    items: CartItem[];
    total: number;  // Keep as number for compatibility
    itemCount: number;
}

export interface CartStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export type CartEventType = 'cartUpdated' | 'itemAdded' | 'itemRemoved' | 'cartCleared';

export interface CartEvent extends Event {
    type: CartEventType;
    detail?: {
        item?: CartItem;
        cartState?: CartState;
    };
}