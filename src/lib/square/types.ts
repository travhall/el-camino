// /src/lib/square/types.ts
export interface Money {
  amount: number; // Always in cents
  currency: string;
}

export interface Product {
  id: string;
  catalogObjectId: string;
  variationId: string;
  title: string;
  description?: string;
  image: string;
  price: number; // For backward compatibility
  url: string;
}

export type SquareMoneyObject = {
  amount?: string | number | bigint;
  currency?: string;
};

export interface OrderDetails {
  id: string;
  status: string;
  totalMoney: Money;
  lineItems: Array<{
    name: string;
    quantity: string;
    totalMoney: Money;
  }>;
}

export interface CartItem {
  id: string;
  catalogObjectId: string;
  variationId: string;
  title: string;
  price: number; // Keep as number for now for backward compatibility
  quantity: number;
  image?: string;
}

export interface SquareProduct {
  id: string;
  catalogObjectId: string;
  variationId: string;
  name: string;
  description?: string;
  priceMoney: Money;
  imageUrl?: string;
}

export interface SquareApiConfig {
  accessToken: string;
  locationId: string;
  environment: "sandbox" | "production";
  version: string;
}

export interface SquareApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface OrderRequest {
  idempotencyKey: string;
  order: {
    lineItems: Array<{
      quantity: string;
      catalogObjectId: string;
      itemType: string;
    }>;
    locationId: string;
  };
}

export interface PaymentLinkResult {
  checkoutUrl: string;
  orderId: string;
}

/**
 * Represents a category in the Square catalog
 */
export interface Category {
  id: string;
  name: string;
  slug: string;
  isTopLevel: boolean;
  parentCategoryId?: string;
  rootCategoryId?: string;
}

/**
 * Represents a hierarchical structure of categories
 * with top-level categories as parents and their subcategories
 */
export interface CategoryHierarchy {
  category: Category;
  subcategories: Category[];
}

/**
 * Represents a product with its category information
 */
export interface ProductWithCategory extends Product {
  categories?: string[]; // Array of category IDs
  reportingCategoryId?: string; // ID of the reporting category
}

/**
 * Raw category data from Square API
 */
export interface SquareCategoryData {
  name: string;
  categoryType: string;
  parentCategory?: {
    id?: string;
    ordinal: string;
  };
  isTopLevel?: boolean;
  onlineVisibility?: boolean;
  rootCategory?: string;
}

/**
 * Result from category hierarchy fetch operation
 */
export interface CategoryResult {
  success: boolean;
  categories: CategoryHierarchy[];
  error?: string;
}
