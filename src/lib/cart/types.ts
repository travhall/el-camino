// /src/lib/cart/types.ts
import type { SaleInfo } from "../square/types";

export interface CartItem {
  id: string;
  catalogObjectId: string;
  variationId: string;
  title: string;
  name?: string; // For test compatibility
  price: number;
  quantity: number;
  image?: string;
  variationName?: string;
  unit?: string; // Add unit property
  catalogVersion?: number; // Add for test compatibility
  saleInfo?: SaleInfo; // Sale pricing information
}

export interface CartState {
  items: CartItem[];
  total: number; // Keep as number for compatibility
  itemCount: number;
}

export interface CartStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type CartEventType =
  | "cartUpdated"
  | "itemAdded"
  | "itemRemoved"
  | "cartCleared";

export interface CartEvent extends Event {
  type: CartEventType;
  detail?: {
    item?: CartItem;
    cartState?: CartState;
  };
}
