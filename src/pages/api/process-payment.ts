import type { APIRoute } from 'astro';
import { squareClient } from '../../lib/square-client';

export const post: APIRoute = async ({ request }) => {
    const { sourceId, cartItems, locationId } = await request.json();

    if (!squareClient) {
        return new Response(JSON.stringify({ error: 'Square client is not available' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const totalAmount = cartItems.reduce((total: number, item: any) => total + item.price * 100 * item.quantity, 0);

        const response = await squareClient.paymentsApi.createPayment({
            sourceId: sourceId,
            idempotencyKey: crypto.randomUUID(),
            amountMoney: {
                amount: BigInt(totalAmount),
                currency: 'USD'
            },
            locationId: locationId
        });

        if (response.result.payment) {
            return new Response(JSON.stringify({ success: true, payment: response.result.payment }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            throw new Error('Payment creation failed');
        }
    } catch (error: unknown) {
        console.error('Error processing payment:', error);
        let errorMessage = 'An unknown error occurred';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return new Response(JSON.stringify({ success: false, error: errorMessage }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};