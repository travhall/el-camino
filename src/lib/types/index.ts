export type {
    Money,
    OrderDetails,
    OrderRequest,
    PaymentLinkResult,
    SquareProduct,
    SquareApiConfig,
    SquareApiResponse
} from '../square/types';

export type {
    CartItem,
    CartState,
    CartStorage,
    CartEvent,
    CartEventType
} from '../cart/types';

// Shared utility types
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        message: string;
        code?: string;
        details?: Record<string, unknown>;
    };
}

export interface PaginationInfo {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
    pagination?: PaginationInfo;
}