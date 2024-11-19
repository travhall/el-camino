// src/lib/types.ts
import type { Money, Order, OrderLineItem, CreateOrderRequest, CreateCheckoutRequest } from 'square';

// Square-related types
export interface ExtendedOrder extends Omit<Order, 'lineItems'> {
  totalMoney?: Money;
  lineItems?: OrderLineItem[];
}

// CartItem represents items in our local cart
export interface CartItem {
  id: string;
  catalogObjectId: string;
  variationId: string;
  title: string;
  price: number;
  quantity: number;
  image?: string;
}

// Square API related interfaces
export interface OrderRequest {
  idempotencyKey: string;
  order: {
    lineItems: Array<{
      quantity: string;
      catalogObjectId: string;
      itemType: string;
      itemVariationId?: string;
      basePriceMoney?: Money;
    }>;
    locationId: string;
    state?: 'DRAFT' | 'OPEN' | 'COMPLETED' | 'CANCELED';
  };
}

export interface CheckoutRequest extends CreateCheckoutRequest {
  locationId: string;
}

export interface CheckoutSession {
  id: string;
  paymentLinkUrl: string;
  orderId: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

// Product represents our internal product model
export interface Product {
  id: string;
  catalogObjectId: string;
  variationId: string;
  title: string;
  description: string;
  image: string;
  price: number;
  url: string;
}

export interface PaymentResult {
  success: boolean;
  error?: string;
  payment?: any;
  orderId?: string;
}

export interface CheckoutFormData {
  email: string;
  name: string;
  phone?: string;
}

// Money handling types
export interface MoneyObject {
  amount: bigint;
  currency: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    details?: any;
  };
}

// Content types
export interface UploadFile {
  url: string;
  alternativeText: string | null;
}

export interface Block {
  __typename: string;
  id?: string;
}

export interface RichTextBlock extends Block {
  __typename: 'ComponentSharedRichText';
  body: string;
}

export interface MediaBlock extends Block {
  __typename: 'ComponentSharedMedia';
  file: UploadFile;
}

export interface QuoteBlock extends Block {
  __typename: 'ComponentSharedQuote';
  title: string;
  body: string;
}

export interface SliderBlock extends Block {
  __typename: 'ComponentSharedSlider';
  files: UploadFile[];
}

export type ContentBlock = RichTextBlock | MediaBlock | QuoteBlock | SliderBlock;

export interface Author {
  name: string;
  avatar?: UploadFile;
}

export interface Category {
  name: string;
  slug: string;
}

export interface Article {
  documentId: string;
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  cover?: UploadFile;
  author?: Author;
  category?: Category;
  blocks?: ContentBlock[];
}

export interface PaginationInfo {
  total: number;
  pageSize: number;
  page: number;
  pageCount: number;
}

export interface Pagination extends PaginationInfo { }

export interface ArticlesResponse {
  articles: Article[];
  meta: {
    pagination: Pagination;
  };
}