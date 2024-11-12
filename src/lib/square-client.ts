import { Client, Environment, ApiError } from 'square';

const isBrowser = typeof window !== 'undefined';

export const squareClient = !isBrowser
    ? new Client({
        accessToken: import.meta.env.SQUARE_ACCESS_TOKEN,
        environment: Environment.Sandbox,
        squareVersion: '2024-10-17',
    })
    : null;

export interface Product {
    id: string;
    title: string;
    description: string;
    image: string;
    price: number;
    url: string;
}

// Custom JSON serializer to handle BigInt
const customJSONStringify = (obj: any): string => {
    return JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint'
            ? value.toString()
            : value
    );
};

function getImageUrl(item: any): string {
    if (item.imageData && item.imageData.url) {
        return item.imageData.url;
    }
    return '/images/placeholder.png';
}

export async function fetchProducts(): Promise<Product[]> {
    if (!squareClient) {
        console.error('Square client is not available in browser environment');
        return [];
    }

    try {
        console.log('Fetching products from Square Production API...');
        console.log('Access Token (first 10 chars):', import.meta.env.SQUARE_ACCESS_TOKEN.substring(0, 10));
        console.log('Environment: Production');
        console.log('Square Version:', '2023-10-18');

        const { result } = await squareClient.catalogApi.listCatalog(undefined, 'ITEM');

        console.log('API Response:', customJSONStringify(result));

        if (!result.objects || result.objects.length === 0) {
            console.log('No objects returned from the API');
            return [];
        }

        const products = result.objects
            .filter(item =>
                item.itemData?.variations &&
                (item.itemData.variations.length ?? 0) > 0
            )
            .map(item => {
                const variation = item.itemData?.variations?.[0];
                const amountInCents = variation?.itemVariationData?.priceMoney?.amount;
                return {
                    id: item.id,
                    title: item.itemData!.name || 'Unnamed Product',
                    description: item.itemData!.description || '',
                    image: getImageUrl(item),
                    price: amountInCents ? Number(amountInCents) / 100 : 0,
                    url: `/product/${item.id}`,
                };
            });

        console.log('Processed products:', customJSONStringify(products));
        return products;
    } catch (error: unknown) {
        if (error instanceof ApiError) {
            console.error('Square API Error:', error.message);
            console.error('Detailed errors:', customJSONStringify(error.errors));
        } else if (error instanceof Error) {
            console.error('Error fetching products:', error.message);
        } else {
            console.error('Unknown error occurred:', error);
        }
        return [];
    }
}