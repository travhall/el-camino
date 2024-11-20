import type { Money as SquareMoney } from 'square';

export interface Money {
    amount: number;  // Always in cents
    currency: string;
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
    price: number;  // Keep as number for now for backward compatibility
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
    environment: 'sandbox' | 'production';
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