// src/lib/square/testing.ts
import type { CartItem } from '../cart/types';
import type { Money } from './types';
import { MoneyUtils } from './money';

export const TestProducts = {
    basic: {
        id: 'TEST_BASIC',
        catalogObjectId: 'YL5SQK7PLL4KVDQWGBKRQQZ4',
        variationId: 'W6ZIJJWJKYBWXNYXFV2M2WOQ',
        title: 'Test Basic Product',
        price: 50,
        image: '/images/placeholder.png'
    },
    withOptions: {
        id: 'TEST_OPTIONS',
        catalogObjectId: 'TEST_CAT_OPTIONS',
        variationId: 'TEST_VAR_OPTIONS',
        title: 'Test Product with Options',
        price: 99.99,
        image: '/images/placeholder.png'
    }
};

export class SquareTesting {
    static createTestOrder(items: CartItem[]) {
        return {
            idempotencyKey: 'test-key',
            order: {
                locationId: 'test-location',
                lineItems: items.map(item => ({
                    quantity: String(item.quantity),
                    catalogObjectId: item.variationId,
                    itemType: 'ITEM'
                }))
            }
        };
    }

    static createTestPayment(amount: number): Money {
        return MoneyUtils.fromFloat(amount);
    }

    static async simulateCheckout(items: CartItem[]) {
        return {
            success: true,
            checkoutUrl: 'https://sandbox.square.link/test-checkout',
            orderId: 'test-order-id'
        };
    }

    static getTestCards() {
        return {
            visa: '4111 1111 1111 1111',
            mastercard: '5105 1051 0510 5100',
            amex: '3782 822463 10005',
            decline: '4000 0000 0000 0002'
        };
    }
}