export interface CartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
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

// src/lib/types.ts

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

export interface ArticlesResponse {
  articles: Article[];
}

export interface Pagination {
  total: number;
  pageSize: number;
  page: number;
  pageCount: number;
}

export interface ArticlesResponse {
  articles: Article[];
  meta: {
    pagination: Pagination;
  };
}