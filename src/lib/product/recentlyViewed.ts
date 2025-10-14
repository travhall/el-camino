// /src/lib/product/recentlyViewed.ts

import type { Product } from "@/lib/square/types";

/**
 * Recently viewed product item stored in localStorage
 */
export interface RecentlyViewedItem {
  id: string;
  variationId: string;
  title: string;
  image: string;
  price: number;
  brand?: string;
  url: string;
  timestamp: number;
}

/**
 * Configuration for recently viewed storage
 */
const STORAGE_KEY = 'el-camino:recently-viewed';
const MAX_ITEMS = 10;
const EXPIRY_DAYS = 30;
const EXPIRY_MS = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

/**
 * Manager for recently viewed products using localStorage
 * Follows the same singleton pattern as cart implementation
 */
export class RecentlyViewedManager {
  private static instance: RecentlyViewedManager;
  private items: RecentlyViewedItem[] = [];

  private constructor() {
    this.load();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RecentlyViewedManager {
    if (!RecentlyViewedManager.instance) {
      RecentlyViewedManager.instance = new RecentlyViewedManager();
    }
    return RecentlyViewedManager.instance;
  }

  /**
   * Load items from localStorage
   */
  private load(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.items = JSON.parse(stored);
        this.pruneExpired();
      }
    } catch (error) {
      console.error('Failed to load recently viewed:', error);
      this.items = [];
    }
  }

  /**
   * Save items to localStorage
   */
  private save(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch (error) {
      console.error('Failed to save recently viewed:', error);
    }
  }

  /**
   * Remove expired items (older than EXPIRY_DAYS)
   */
  private pruneExpired(): void {
    const now = Date.now();
    const initialLength = this.items.length;
    
    this.items = this.items.filter(item => {
      const age = now - item.timestamp;
      return age < EXPIRY_MS;
    });

    if (this.items.length !== initialLength) {
      this.save();
    }
  }

  /**
   * Add a product to recently viewed
   * Removes duplicates and adds to front of list
   */
  add(product: Product): void {
    const item: RecentlyViewedItem = {
      id: product.id,
      variationId: product.selectedVariationId || product.variationId,
      title: product.title,
      image: product.image,
      price: product.price,
      brand: product.brand,
      url: product.url,
      timestamp: Date.now()
    };

    // Remove if exists (deduplication)
    this.items = this.items.filter(i => i.id !== item.id);

    // Add to front
    this.items.unshift(item);

    // Enforce max items
    if (this.items.length > MAX_ITEMS) {
      this.items = this.items.slice(0, MAX_ITEMS);
    }

    this.save();
  }

  /**
   * Get recently viewed items
   * @param limit Optional limit on number of items to return
   * @returns Array of recently viewed items
   */
  get(limit?: number): RecentlyViewedItem[] {
    this.pruneExpired();
    
    if (limit && limit > 0) {
      return this.items.slice(0, limit);
    }
    
    return [...this.items];
  }

  /**
   * Remove a specific item by ID
   */
  remove(id: string): void {
    this.items = this.items.filter(item => item.id !== id);
    this.save();
  }

  /**
   * Clear all recently viewed items
   */
  clear(): void {
    this.items = [];
    this.save();
  }

  /**
   * Get count of items
   */
  count(): number {
    this.pruneExpired();
    return this.items.length;
  }
}

/**
 * Export singleton instance for convenient access
 */
export const recentlyViewed = RecentlyViewedManager.getInstance();
