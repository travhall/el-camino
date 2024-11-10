import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
    console.log("Create checkout endpoint hit");
    try {
        const { cartItems, locationId } = await request.json();
        console.log("Received cart items:", cartItems);
        console.log("Received location ID:", locationId);

        // Server-side code should NOT make Square API calls.
        // Only receive cart data and location ID, then return a success response.

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error: unknown) {
        console.error('Error creating checkout:', error);

        let errorMessage = 'An unknown error occurred';
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        return new Response(JSON.stringify({ error: 'Failed to create checkout', details: errorMessage }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
};
