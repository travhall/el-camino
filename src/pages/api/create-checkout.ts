import type { APIRoute } from 'astro';
import { Client, Environment } from 'square';

const squareClient = new Client({
    accessToken: import.meta.env.SQUARE_ACCESS_TOKEN || '',
    environment: Environment.Sandbox,
    squareVersion: '2024-02-28'
});

export const POST: APIRoute = async ({ request }) => {
    try {
        const { items } = await request.json();

        if (!items?.length) {
            return new Response(
                JSON.stringify({ error: 'No items provided' }),
                { status: 400 }
            );
        }

        console.log('Creating order with items:', items);

        // Calculate total amount
        const totalAmount = items.reduce(
            (sum: number, item: any) => sum + (item.price * item.quantity),
            0
        );

        // Create the order first
        const orderResponse = await squareClient.ordersApi.createOrder({
            idempotencyKey: crypto.randomUUID(),
            order: {
                locationId: import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
                lineItems: items.map((item: any) => ({
                    quantity: String(item.quantity),
                    catalogObjectId: item.variationId, // Use variationId instead of catalogObjectId
                    itemType: 'ITEM'
                }))
            }
        });

        if (!orderResponse.result.order?.id) {
            throw new Error('Failed to create order');
        }

        console.log('Order created:', orderResponse.result.order.id);

        // Create payment link with the order
        const linkResponse = await squareClient.checkoutApi.createPaymentLink({
            idempotencyKey: crypto.randomUUID(),
            order: {
                locationId: import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
                lineItems: items.map((item: any) => ({
                    quantity: String(item.quantity),
                    catalogObjectId: item.variationId,
                    itemType: 'ITEM'
                }))
            },
            checkoutOptions: {
                redirectUrl: new URL('/order-confirmation', request.url).toString(),
                askForShippingAddress: true
            }
        });

        if (!linkResponse.result.paymentLink?.url) {
            throw new Error('Failed to create payment link');
        }

        console.log('Payment link created:', linkResponse.result.paymentLink.url);

        return new Response(
            JSON.stringify({
                success: true,
                checkoutUrl: linkResponse.result.paymentLink.url,
                orderId: orderResponse.result.order.id
            }),
            { status: 200 }
        );
    } catch (error) {
        console.error('Checkout error:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            details: error
        });

        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Checkout creation failed',
                details: error
            }),
            { status: 500 }
        );
    }
};