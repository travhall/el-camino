import type { APIRoute } from 'astro';
import type { CartItem } from '@/lib/types';
import { squareClient, jsonStringifyReplacer } from '@/lib/square-client';
import { ValidationError } from '@/lib/errors';
import type { CreatePaymentLinkRequest, Money } from 'square';

interface RequestBody {
    items: CartItem[];
    email?: string;
}

function createMoney(amount: number): Money {
    return {
        amount: BigInt(Math.round(amount * 100)),
        currency: 'USD'
    };
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json() as RequestBody;
        console.log('Starting checkout process with items:', body.items);

        if (!body.items?.length) {
            throw new ValidationError('No items provided');
        }

        const locationId = import.meta.env.PUBLIC_SQUARE_LOCATION_ID;

        // Calculate total price
        const totalAmount = body.items.reduce((total, item) =>
            total + (item.price * item.quantity), 0);

        // Create payment link with proper typing
        const paymentLinkRequest: CreatePaymentLinkRequest = {
            idempotencyKey: crypto.randomUUID(),
            quickPay: {
                name: 'El Camino Shop Order',
                priceMoney: createMoney(totalAmount),
                locationId
            },
            checkoutOptions: {
                allowTipping: false,
                redirectUrl: `${new URL(request.url).origin}/order-confirmation`,
                merchantSupportEmail: 'support@example.com'
            }
        };

        console.log('Creating payment link...', JSON.stringify(paymentLinkRequest, jsonStringifyReplacer, 2));
        const paymentResponse = await squareClient.checkoutApi.createPaymentLink(paymentLinkRequest);
        console.log('Payment link response:', JSON.stringify(paymentResponse.result, jsonStringifyReplacer, 2));

        if (!paymentResponse.result?.paymentLink?.url) {
            throw new Error('Failed to create payment link');
        }

        return new Response(JSON.stringify({
            success: true,
            checkoutUrl: paymentResponse.result.paymentLink.url,
            paymentLinkId: paymentResponse.result.paymentLink.id,
            amount: totalAmount,
            items: body.items.length
        }, jsonStringifyReplacer), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Checkout error:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });

        return new Response(JSON.stringify({
            success: false,
            error: {
                message: error instanceof Error ? error.message : 'Checkout failed',
                details: error instanceof Error ? error.stack : undefined
            }
        }, jsonStringifyReplacer), {
            status: error instanceof ValidationError ? 400 : 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};