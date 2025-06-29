// /src/lib/square/types.ts

import type { AppError } from "./errorUtils";
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
  variations?: ProductVariation[];
  selectedVariationId?: string;
  brand?: string;
  unit?: string;
  // New: Available attributes for this product
  availableAttributes?: Record<string, string[]>;
}

export interface ProductData {
  id: string;
  catalogObjectId: string;
  variationId: string;
  title: string;
  price: number;
  image?: string;
  unit?: string;
  variationName?: string;
  quantity?: number;
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

export interface SquareProduct {
  id: string;
  catalogObjectId: string;
  variationId: string;
  name: string;
  description?: string;
  priceMoney: Money;
  imageUrl?: string;
}

export interface ProductVariation {
  id: string;
  variationId: string;
  name: string;
  price: number;
  inStock?: boolean; // Add this
  quantity?: number; // Add this
  image?: string; // Add this
  unit?: string; // Add this
  attributes?: Record<string, string>; // Add this
}

export interface VariationSelectionState {
  selectedAttributes: Record<string, string>;
  availableAttributes: Record<string, string[]>;
  currentVariation?: ProductVariation;
}

export interface VariationConfig {
  attributeMappings: Record<number, string[]>;
  displayNames: Record<string, string>;
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
  apiIndex?: number; // Position in API response array
  rawOrder?: number; // Any potential ordering field from API
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

/**
 * Product availability state enum for consistent state management
 */
export enum ProductAvailabilityState {
  OUT_OF_STOCK = "out_of_stock", // Total inventory = 0
  ALL_IN_CART = "all_in_cart", // Remaining = 0, total > 0
  AVAILABLE = "available", // Remaining > 0
}

/**
 * Product availability information
 */
export interface ProductAvailabilityInfo {
  state: ProductAvailabilityState;
  totalInventory: number;
  inCart: number;
  remaining: number;
}

/**
 * Determine product availability state based on inventory and cart quantities
 * @param totalInventory Total inventory available
 * @param inCart Quantity currently in cart
 * @returns ProductAvailabilityState
 */
export function getAvailabilityState(
  totalInventory: number,
  inCart: number
): ProductAvailabilityState {
  if (totalInventory === 0) {
    return ProductAvailabilityState.OUT_OF_STOCK;
  }

  const remaining = totalInventory - inCart;
  if (remaining === 0) {
    return ProductAvailabilityState.ALL_IN_CART;
  }

  return ProductAvailabilityState.AVAILABLE;
}

/**
 * Get complete availability information for a product variation
 * @param totalInventory Total inventory available
 * @param inCart Quantity currently in cart
 * @returns ProductAvailabilityInfo
 */
export function getAvailabilityInfo(
  totalInventory: number,
  inCart: number
): ProductAvailabilityInfo {
  const remaining = Math.max(0, totalInventory - inCart);
  const state = getAvailabilityState(totalInventory, inCart);

  return {
    state,
    totalInventory,
    inCart,
    remaining,
  };
}

/**
 * Get appropriate button text based on availability state
 * @param state ProductAvailabilityState
 * @returns Button text string
 */
export function getButtonText(state: ProductAvailabilityState): string {
  switch (state) {
    case ProductAvailabilityState.OUT_OF_STOCK:
      return "Sold Out";
    case ProductAvailabilityState.ALL_IN_CART:
      return "All in Cart";
    case ProductAvailabilityState.AVAILABLE:
      return "Add to Cart";
    default:
      return "Add to Cart";
  }
}

/**
 * Get appropriate status message based on availability state
 * @param info ProductAvailabilityInfo
 * @returns Status message string
 */
export function getStatusMessage(info: ProductAvailabilityInfo): string {
  switch (info.state) {
    case ProductAvailabilityState.OUT_OF_STOCK:
      return "Out of Stock";
    case ProductAvailabilityState.ALL_IN_CART:
      return `${info.inCart} in cart`;
    case ProductAvailabilityState.AVAILABLE:
      return info.remaining === 1
        ? "1 remaining"
        : `${info.remaining} remaining`;
    default:
      return "";
  }
}

/**
 * Determine if add to cart button should be disabled
 * @param state ProductAvailabilityState
 * @returns boolean
 */
export function isButtonDisabled(state: ProductAvailabilityState): boolean {
  return (
    state === ProductAvailabilityState.OUT_OF_STOCK ||
    state === ProductAvailabilityState.ALL_IN_CART
  );
}

/**
 * Get default quantity for quantity input based on availability state
 * @param state ProductAvailabilityState
 * @returns default quantity number
 */
export function getDefaultQuantity(state: ProductAvailabilityState): number {
  return state === ProductAvailabilityState.AVAILABLE ? 1 : 0;
}

/**
 * Get maximum allowed quantity for quantity input
 * @param info ProductAvailabilityInfo
 * @returns maximum quantity number
 */
export function getMaxQuantity(info: ProductAvailabilityInfo): number {
  return info.state === ProductAvailabilityState.AVAILABLE
    ? info.remaining
    : info.inCart;
}

/**
 * Determine if quantity input should be disabled
 * @param state ProductAvailabilityState
 * @returns boolean
 */
export function isQuantityInputDisabled(
  state: ProductAvailabilityState
): boolean {
  return state !== ProductAvailabilityState.AVAILABLE;
}

export interface PaginatedProducts {
  products: Product[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface ProductLoadingOptions {
  limit?: number;
  cursor?: string;
}

export type DisplayPreference = 24 | 48 | 96 | "all";

/**
 * Navigation-specific interfaces that extend existing Category system
 */
export interface NavigationItem {
  category: Category;
  subcategories: Category[];
  hasProducts?: boolean; // Leverage existing product checking
}

export interface NavigationConfig {
  items: NavigationItem[];
  staticItems: StaticNavigationItem[];
  mobileBreakpoint: number;
  animationDuration: number;
}

export interface StaticNavigationItem {
  id: string;
  name: string;
  slug: string;
  url: string;
  subcategories: StaticNavigationSubItem[];
}

export interface StaticNavigationSubItem {
  id: string;
  name: string;
  slug: string;
  url: string;
}

/**
 * Navigation accessibility interfaces
 */
export interface NavigationAccessibility {
  hasSubmenu: boolean;
  isExpanded: boolean;
  ariaLabel: string;
  keyboardSupport: boolean;
}

/**
 * Navigation performance metrics
 */
export interface NavigationMetrics {
  renderTime: number;
  cacheHitRate: number;
  interactionLatency: number;
}

/**
 * Navigation error states
 */
export interface NavigationError extends AppError {
  fallbackUsed: boolean;
  staticItemsOnly: boolean;
}

/**
 * Product filtering interfaces
 */
export interface ProductFilters {
  brands: string[];
  availability?: boolean;
}

export interface FilterOptions {
  brands: BrandOption[];
}

export interface BrandOption {
  name: string;
  count: number;
  slug: string;
}

export interface FilterState {
  activeBrands: Set<string>;
  availabilityOnly?: boolean;
}

/**
 * Filter utility functions
 */
export function createFilterSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .trim();
}

/**
 * Pagination metadata for UI components
 */
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalProducts: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Extended loading options that include pagination and filtering
 */
export interface PaginationOptions extends ProductLoadingOptions {
  page?: number;
  pageSize?: number;
  filters?: ProductFilters;
}

/**
 * Enhanced paginated products with metadata for UI
 */
export interface PaginatedProductsWithMeta extends PaginatedProducts {
  pagination: PaginationMeta;
  appliedFilters: ProductFilters;
  filterOptions: FilterOptions;
}

/**
 * URL parameter parsing result
 */
export interface ParsedURLParams {
  filters: ProductFilters;
  page: number;
  pageSize: number;
}

/**
 * Calculate pagination metadata from cursor-based results
 */
export function calculatePaginationMeta(
  currentPage: number,
  pageSize: number,
  productCount: number,
  hasMore: boolean,
  totalProducts?: number
): PaginationMeta {
  // Estimate total pages if total not provided
  const estimatedTotal =
    totalProducts || (hasMore ? currentPage * pageSize + 1 : productCount);
  const totalPages = Math.max(1, Math.ceil(estimatedTotal / pageSize));

  return {
    currentPage,
    totalPages,
    pageSize,
    totalProducts: estimatedTotal,
    hasNextPage: hasMore,
    hasPrevPage: currentPage > 1,
  };
}
